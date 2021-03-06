import StringEx from "../../LTGame/LTUtils/StringEx";

export class SaveData {

    /**
     * 金币数量
     */
    public coinCount: number = 0;
    /**
     * 当前关卡id
     */
    public levelId: number = 1;

}

export default class GameData {

    private static _instance: GameData;
    public static get instance(): SaveData {
        if (this._instance == null) {
            this._instance = new GameData();
            this._instance._ReadFromFile();
        }
        return this._instance._saveData;
    }

    private _savePath = "game01.sav";

    private _saveData: SaveData;

    public static SaveToDisk() {
        if (!this._instance) return;
        let json = JSON.stringify(this._instance._saveData);
        Laya.LocalStorage.setJSON(this._instance._savePath, json);
    }

    private _ReadFromFile() {
        let readStr = Laya.LocalStorage.getJSON(this._savePath);
        this._saveData = new SaveData();
        if (!StringEx.IsNullOrEmpty(readStr)) {
            let jsonData = JSON.parse(readStr);
            for (let key in jsonData) {
                this._saveData[key] = jsonData[key];
            }
        }

        console.log(this._saveData);
    }

}