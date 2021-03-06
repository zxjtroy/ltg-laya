import * as fs from "fs";
import * as path from "path";
import { LTPackNode } from "./LTPackNode";
import { LTUtils } from "LTUtils";
import { EPackResolveType } from "EPackResolveType";
import { IPackConfig } from "IPackConfig";

export class SubpackHelper {

    private _rootPath: string;
    private _rootNode: LTPackNode;

    public single_max_size = 4 * 1024 * 1024;
    public total_max_size = 4 * 1024 * 1024;
    private _cacheSize: number;

    private _subpacks: LTPackNode[];
    private _remoteFiles: LTPackNode[];

    private _packConfig: IPackConfig;

    constructor(rootPath: string, packConfig: IPackConfig) {
        this._rootPath = rootPath;
        this._packConfig = packConfig;
        this._rootNode = new LTPackNode();
        this._rootNode.fullPath = rootPath;
        this._rootNode.isNode = false;
    }

    /**
     * 进行分析
     */
    public Analyze() {
        this._AnalyzeDir(this._rootPath, this._rootNode);
        this._CombieNode(this._rootNode);
        let kb = Math.ceil(this._rootNode.size / 1024);
        let mb = kb / 1024;
        console.log("资源包:", this._rootNode.fullPath, "总共", kb.toFixed(0) + "kb (" + mb.toFixed(2) + "mb)");

        this._subpacks = [];
        this._remoteFiles = [];
        this._cacheSize = 0;
        // 优先进行强制主包
        let upRootPath = path.join(this._rootPath, "./../");
        for (let i = 0; i < this._packConfig.forceInPack.length; ++i) {
            let forceMainPack = this._packConfig.forceInPack[i];
            let fullPath = path.join(upRootPath, forceMainPack);
            console.log("强制主包", fullPath.green);
            let fakePack = new LTPackNode();
            fakePack.isNode = false;
            let dirStat = fs.statSync(fullPath);
            fakePack.size = dirStat.size;
            fakePack.fullPath = fullPath;
            this._subpacks.push(fakePack);
            this._cacheSize += fakePack.size;
        }
        this._SplitSubpack(this._rootNode, this._subpacks, this._remoteFiles);

        kb = Math.ceil(this._cacheSize / 1024);
        mb = kb / 1024;
        console.log("拆分子包个数", this._subpacks.length, "总子包大小", kb.toFixed(0) + "kb (" + mb.toFixed(2) + "mb)");
    }

    /**
     * 进行包替换
     */
    public Replace(subpackPath: string, cdnPath: string) {
        LTUtils.DeleteDir(cdnPath);
        // 将远程文件放到一个文件夹
        for (let i = 0; i < this._remoteFiles.length; ++i) {
            let remoteFile = this._remoteFiles[i];
            let relativePath = remoteFile.fullPath.replace(this._rootPath, "");
            let targetPath = path.join(cdnPath, relativePath);

            if (remoteFile.isNode) {
                // 拷贝文件
                LTUtils.CopyFile(remoteFile.fullPath, targetPath);
            } else {
                // 拷贝文件夹
                LTUtils.CopyDir(remoteFile.fullPath, targetPath);
            }

        }

        LTUtils.DeleteDir(subpackPath);
        // 将子包放到一个文件夹
        for (let i = 0; i < this._subpacks.length; ++i) {
            let subpack = this._subpacks[i];
            if (subpack.isNode) {
                console.log("子包检测到单文件,请注意检查".red, subpack.fullPath);
                continue;
            }
            let relativePath = subpack.fullPath.replace(this._rootPath, "");
            let targetPath = path.join(subpackPath, relativePath);

            LTUtils.CopyDir(subpack.fullPath, targetPath);

            // 检查有没有game.js,没有则主动创建
            let jsPath = path.join(targetPath, "./game.js");
            if (!fs.existsSync(jsPath)) {
                LTUtils.WriteStrTo(jsPath, "");
            }
        }

        // 生成game.json
        let gameJsonPath = path.join(subpackPath, "./../game.json");
        let gameJsonStr = fs.readFileSync(gameJsonPath, {
            "encoding": "utf-8"
        });
        let gameJson = JSON.parse(gameJsonStr);
        let subpacks = [];
        let upRootPath = path.join(this._rootPath, "./../");
        for (let i = 0; i < this._subpacks.length; ++i) {
            let subpack = this._subpacks[i];
            if (subpack.isNode) continue;
            let relativePath = subpack.fullPath.replace(upRootPath, "");
            let checkRelativePath = relativePath.replace("\\", "/");
            if (this._packConfig.packType == EPackResolveType.AutoSearch) {
                if (this._packConfig.forceInPack.indexOf(checkRelativePath) >= 0) {
                    console.log("强制主包", checkRelativePath.green);
                } else {
                    subpacks.push({
                        "name": relativePath,
                        "root": relativePath
                    });
                }
            }
        }

        // 写出game.json文件
        gameJson['subpackages'] = subpacks;
        let outputjson = JSON.stringify(gameJson);
        while (outputjson.indexOf("\\\\") >= 0) {
            outputjson = outputjson.replace("\\\\", "/");
        }
        fs.writeFileSync(gameJsonPath, outputjson, {
            "encoding": "utf-8"
        });

        // 写出subpack.json文件
        let subpackJsonData = [];
        for (let i = 0; i < this._subpacks.length; ++i) {
            let subpack = this._subpacks[i];
            let relativePath = subpack.fullPath.replace(upRootPath, "");
            let checkRelativePath = LTUtils.ReplaceAll(relativePath, "\\", "/");
            let packType = this._packConfig.packType == EPackResolveType.AllIn ? 1 : 2;
            if (this._packConfig.forceInPack.indexOf(checkRelativePath) >= 0) {
                packType = 1;
            }
            subpackJsonData.push(
                {
                    "path": checkRelativePath,
                    "pathType": packType
                }
            );
        }

        let upSubpackPath = path.join(subpackPath, "./../");
        let subpackJsonStr = JSON.stringify(subpackJsonData);
        let subpackJsonPath = path.join(upSubpackPath, "./subpack.json");
        fs.writeFileSync(subpackJsonPath, subpackJsonStr, {
            "encoding": "utf-8"
        });
        console.log("输出subpack.json", subpackJsonPath);
    }

    private _SplitSubpack(node: LTPackNode, subPacks: LTPackNode[], remoteFiles: LTPackNode[]) {
        let upRootPath = path.join(this._rootPath, "./../");
        // 进行包整理
        for (let i = 0; i < node.childs.length; ++i) {
            let child = node.childs[i];
            if (child.isNode) {
                // 散文件
                remoteFiles.push(child);
            } else {
                // 文件夹
                let relativePath = child.fullPath.replace(upRootPath, "");
                relativePath = relativePath.replace("\\", "/");
                let isInForceMainPack = this._packConfig.forceInPack.indexOf(relativePath) >= 0;
                if (!isInForceMainPack) {
                    let isInForceRemote = this._packConfig.forceRemote.indexOf(relativePath) >= 0;
                    if (isInForceRemote || this._packConfig.packType == EPackResolveType.AllOut) {
                        console.log("强制远程包", relativePath.green);
                        remoteFiles.push(child);
                    } else {
                        if (child.size > this.single_max_size) {
                            this._SplitSubpack(child, subPacks, remoteFiles);
                        } else {
                            if (child.size + this._cacheSize < this.total_max_size) {
                                subPacks.push(child);
                                this._cacheSize += child.size;
                            } else {
                                this._SplitSubpack(child, subPacks, remoteFiles);
                            }
                        }
                    }
                }
            }
        }
    }

    private _CombieNode(node: LTPackNode) {
        for (let i = 0; i < node.childs.length; ++i) {
            let childNode = node.childs[i];
            if (!childNode.isNode) {
                this._CombieNode(childNode);
            }
            node.size += childNode.size;
        }
    }

    private _AnalyzeDir(currentPath: string, node: LTPackNode) {
        let files = fs.readdirSync(currentPath);
        for (let i = 0; i < files.length; ++i) {
            let fileName = files[i];
            let filePath = path.join(currentPath, fileName);
            let fileStat = fs.statSync(filePath);
            let createNode = new LTPackNode();
            createNode.fullPath = filePath;
            createNode.parent = node;
            node.childs.push(createNode);
            if (fileStat.isDirectory()) {
                createNode.isNode = false;
                this._AnalyzeDir(filePath, createNode);
            } else {
                createNode.isNode = true;
                createNode.size = fileStat.size;
            }
        }
    }

}