import IPlatform from "./IPlatform";
import StringEx from "../LTUtils/StringEx";
import { EPlatformType } from "./EPlatformType";
import LTPlatformData from "./Data/LTPlatformData";
import { ShareInfo } from "./ShareInfo";
import ShareManager from "./ShareManager";
import LTPlatform from "./LTPlatform";
import { CommonEventId } from "../Commom/CommonEventId";
import IRecordManager from "./IRecordManager";
import DefaultRecordManager from "./DefaultRecordManager";
import LTUI from "../UIExt/LTUI";
import Awaiters from "../Async/Awaiters";

export default class WXPlatform implements IPlatform {
    onPause: Laya.Handler;
    appId: string;
    platform: EPlatformType = EPlatformType.WX;
    safeArea: LTGame.SafeArea = null;
    lauchOption: LTGame.LaunchOption;
    loginState: LTGame.LoginState;
    onLoginEnd: Laya.Handler;
    onResume: Laya.Handler;
    recordManager: IRecordManager = new DefaultRecordManager();

    protected _data: LTPlatformData;

    protected _bannerAd;
    protected _rewardVideo;
    protected _intersitialAd;

    protected _isBannerLoaded: boolean = false;
    protected _isVideoLoaded: boolean = false;
    protected _isInterstitialLoaded: boolean = false;
    protected _videoFailedCount: number;
    protected _interstitalFailedCount: number;

    protected _rewardSuccessed: Laya.Handler;
    protected _rewardSkipped: Laya.Handler;

    protected _cacheScreenScale: number;

    protected _shareVideoBtn;

    protected _base: any;

    protected _platformData: LTPlatformData;

    protected _cacheVideoAD: boolean = false;

    protected _cacheOnShowHandle: Laya.Handler;

    Init(platformData: LTPlatformData) {
        this._base = window["wx"];
        if (this._base == null) {
            console.error("平台初始化错误", LTPlatform.platformStr);
            return;
        }

        this._platformData = platformData;
        this._InitLauchOption();
        this._Login();
        this._InitShareInfo();
        this._InitSystemInfo();
        this._CreateBannerAd();
        this._CreateVideoAd();
        this._CreateInterstitalAd();

        window["iplatform"] = this;
    }

    _CheckUpdate() {
        let updateManager = this._base.getUpdateManager();
        if (updateManager == null) return;

        updateManager.onCheckForUpdate(function (res) {
            // 请求完新版本信息的回调
            console.log("onCheckForUpdate", res.hasUpdate);
            if (res.hasUpdate) {
                this._base.showToast({
                    title: "即将有更新请留意"
                });
            }
        });

        updateManager.onUpdateReady(() => {
            this._base.showModal({
                title: "更新提示",
                content: "新版本已经准备好，是否立即使用？",
                success: function (res) {
                    if (res.confirm) {
                        // 调用 applyUpdate 应用新版本并重启
                        updateManager.applyUpdate();
                    } else {
                        this._base.showToast({
                            icon: "none",
                            title: "小程序下一次「冷启动」时会使用新版本"
                        });
                    }
                }
            });
        });

        updateManager.onUpdateFailed(() => {
            this._base.showToast({
                title: "更新失败，下次启动继续..."
            });
        });
    }

    protected _Login() {
        this.loginState = {
            isLogin: false,
            code: ""
        };
        let loginData = {} as LTGame.LoginData;
        loginData.success = (res) => {
            this._OnLoginSuccess(res);
        };
        loginData.fail = (res) => {
            console.error(LTPlatform.platformStr, "登录失败", res);
            this.loginState.isLogin = false;
            this.loginState.code = "";
        };
        loginData.complete = (res) => {
            if (this.onLoginEnd != null) {
                this.onLoginEnd.run();
            }
        };
        this._base.login(loginData);
    }

    protected _OnLoginSuccess(res: LTGame.LoginSuccessRes) {
        console.log(LTPlatform.platformStr, "登录成功", res);
        this.loginState.isLogin = true;
        this.loginState.code = res.code;
    }

    protected _InitLauchOption() {
        // 绑定onShow事件
        this._base.onShow(this._OnShow);
        this._base.onHide(this._OnHide);
        // 自动获取一次启动参数
        let res = this._base.getLaunchOptionsSync() as LTGame.LaunchOption;
        this._OnShow(res);
    }

    protected _InitShareInfo() {
        this._base.showShareMenu({
            withShareTicket: true,
            success: (res) => {
                console.log("InitShareSuccess", res);
            },
            fail: (res) => {
                console.log("InitShareFailed", res);
            },
            complete: (res) => {
                console.log("InitShareComplete", res);
            }
        });
        this._base.onShareAppMessage(
            () => {
                let shareInfo = ShareManager.instance.GetShareInfo();
                return WXPlatform._WrapShareInfo(shareInfo);
            }
        );
    }

    protected static _WrapShareInfo(shareInfo: ShareInfo) {
        let shareObj = {};
        if (shareInfo.shareTitle) {
            shareObj["title"] = shareInfo.shareTitle;
        }
        if (shareInfo.shareImg) {
            shareObj["imageUrl"] = shareInfo.shareImg;
        }
        if (shareInfo.sharePath) {
            shareObj["query"] = {};
            let pathSplit = shareInfo.sharePath.split("?");
            let params = pathSplit[1].split("&");
            for (let getParam of params) {
                let splitParam = getParam.split("=");
                shareObj["query"][splitParam[0]] = splitParam[1];
            }
        }
        return shareObj;
    }

    protected _InitSystemInfo() {
        try {
            let systemInfo = this._base.getSystemInfoSync();
            this.safeArea = systemInfo.safeArea as LTGame.SafeArea;
            this._cacheScreenScale = systemInfo.screenWidth / Laya.stage.width;
        } catch (e) {
            console.error(e);
            console.error("获取设备信息失败,执行默认初始化");
            this.safeArea = null;
        }
    }

    protected _CreateInterstitalAd() {
        if (StringEx.IsNullOrEmpty(this._platformData.interstitialId)) {
            console.log("无有效的插页广告ID,取消加载");
            return;
        }
        this._interstitalFailedCount = 0;
        let intAdObj = {};
        intAdObj["adUnitId"] = this._platformData.interstitialId;
        this._intersitialAd = this._base.createInterstitialAd(intAdObj);

        this._intersitialAd.onLoad(() => {
            console.log("插页广告加载成功");
            this._isInterstitialLoaded = true;
        });
        this._intersitialAd.onError((err) => {
            this._interstitalFailedCount++;
            console.error("插页广告加载失败", err);
            if (this._interstitalFailedCount > 10) {
                console.log("第", this._interstitalFailedCount, "次重新加载插页广告");
                // 失败自动加载广告
                this._intersitialAd.load();
            }
        });
    }

    protected _CreateVideoAd() {
        if (!this._cacheVideoAD) {
            console.log("当前策略为不缓存视频广告");
            return;
        }
        let createRewardedVideoAd = this._base["createRewardedVideoAd"];
        if (createRewardedVideoAd == null) {
            console.error("无createRewardedVideoAd方法,跳过初始化");
            return;
        }
        if (StringEx.IsNullOrEmpty(this._platformData.rewardVideoId)) {
            console.log("无有效的视频广告ID,取消加载");
            return;
        }
        this._videoFailedCount = 0;
        let videoObj = {};
        videoObj["adUnitId"] = this._platformData.rewardVideoId; // "adunit-5631637236cf16b6";
        this._rewardVideo = createRewardedVideoAd(videoObj);
        this._rewardVideo.onLoad(() => {
            console.log("视频广告加载成功");
            this._isVideoLoaded = true;
        });
        this._rewardVideo.onError((res) => {
            this._videoFailedCount++;
            console.error("视频广告加载失败", res);
            if (this._videoFailedCount > 10) {
                console.log("第", this._videoFailedCount, "次重新加载视频广告");
                // 失败自动加载广告
                this._rewardVideo.load();
            }
        });
        this._rewardVideo.onClose((res) => {

            Laya.stage.event(CommonEventId.RESUM_AUDIO);
            console.log("视频回调", res);

            let isEnd = res["isEnded"] as boolean;

            // 修复广告bug
            Awaiters.NextFrame().then(() => {
                if (isEnd) {
                    if (this._rewardSuccessed) this._rewardSuccessed.run();
                } else {
                    if (this._rewardSkipped) this._rewardSkipped.run();
                }
            });
        });
    }

    protected _CreateBannerAd() {
        if (StringEx.IsNullOrEmpty(this._platformData.bannerId)) {
            console.log("无有效的banner广告ID,取消加载");
            return;
        }
        let windowWidth = this._base.getSystemInfoSync().windowWidth;
        let windowHeight = this._base.getSystemInfoSync().windowHeight;
        let bannerObj = {};
        bannerObj["adUnitId"] = this._platformData.bannerId; // "adunit-b48894d44d318e5a";
        bannerObj["adIntervals"] = 30;
        let styleObj = {};
        styleObj["left"] = 0;
        styleObj["top"] = 0;
        styleObj["width"] = 300;
        bannerObj["style"] = styleObj;

        this._bannerAd = this._base.createBannerAd(bannerObj);
        this._isBannerLoaded = false;

        this._bannerAd.onLoad(() => {
            console.log("banner加载成功");
            this._isBannerLoaded = true;
            this._bannerAd.style.top = windowHeight - this._bannerAd.style.realHeight;
            this._bannerAd.style.left = (windowWidth - this._bannerAd.style.realWidth) / 2;
        });

        this._bannerAd.onError((res) => {
            console.error("banner广告加载失败", res);
        });
    }

    IsBannerAvaliable() {
        return this._isBannerLoaded;
    }
    IsVideoAvaliable() {
        return this._isVideoLoaded;
    }
    IsInterstitalAvaliable() {
        return this._isInterstitialLoaded;
    }
    ShowBannerAd() {
        if (!this.IsBannerAvaliable()) {
            return;
        }
        this._bannerAd.show();
    }
    HideBannerAd() {
        if (!this.IsBannerAvaliable()) return;
        this._bannerAd.hide();
    }

    protected _DoCacheShowVideo(onSuccess: Laya.Handler, onSkipped: Laya.Handler) {
        if (!this._isVideoLoaded) {
            console.error("视频广告尚未加载好");
            return;
        }
        this._rewardSuccessed = onSuccess;
        this._rewardSkipped = onSkipped;
        this._isVideoLoaded = false;
        Laya.stage.event(CommonEventId.PAUSE_AUDIO);
        this._rewardVideo.show();
    }

    protected _DoNoCacheShowVideo(onSuccess: Laya.Handler, onSkipped: Laya.Handler) {
        this._rewardSuccessed = onSuccess;
        this._rewardSkipped = onSkipped;
        if (StringEx.IsNullOrEmpty(this._platformData.rewardVideoId)) {
            console.log("无有效的视频广告ID,取消加载");
            return;
        }
        let createRewardedVideoAd = this._base["createRewardedVideoAd"];
        if (createRewardedVideoAd == null) {
            console.error("无createRewardedVideoAd方法,跳过初始化");
            return;
        }
        LTUI.ShowLoading("广告拉取中...");
        this._videoFailedCount = 0;
        let videoObj = {};
        videoObj["adUnitId"] = this._platformData.rewardVideoId; // "adunit-5631637236cf16b6";
        this._rewardVideo = createRewardedVideoAd(videoObj);
        this._rewardVideo.onLoad(() => {
            console.log("视频广告加载成功");
            this._isVideoLoaded = true;
        });
        this._rewardVideo.onError((res) => {
            this._videoFailedCount++;
            console.error("视频广告加载失败", res, this._videoFailedCount);
        });
        this._rewardVideo.onClose((res) => {

            Laya.stage.event(CommonEventId.RESUM_AUDIO);
            console.log("视频回调", res);
            let isEnd = res["isEnded"] as boolean;
            Awaiters.NextFrame().then(() => {
                if (isEnd) {
                    if (this._rewardSuccessed) this._rewardSuccessed.run();
                } else {
                    if (this._rewardSkipped) this._rewardSkipped.run();
                }
            });
        });

        this._rewardVideo.show().then(() => {
            LTUI.HideLoading();
        }).catch(err => {
            console.log("广告组件出现问题", err);
            // 可以手动加载一次
            this._rewardVideo.load().then(() => {
                console.log("手动加载成功");
                // 加载成功后需要再显示广告
                return this._rewardVideo.show();
            });
        });;
    }

    ShowRewardVideoAd(onSuccess: Laya.Handler, onSkipped: Laya.Handler) {
        if (this._cacheVideoAD) {
            this._DoCacheShowVideo(onSuccess, onSkipped);
        } else {
            this._DoNoCacheShowVideo(onSuccess, onSkipped);
        }

    }
    ShowRewardVideoAdAsync(): Promise<boolean> {
        return new Promise(function (resolve) {
            LTPlatform.instance.ShowRewardVideoAd(Laya.Handler.create(this, () => {
                resolve(true);
            }), Laya.Handler.create(this, () => {
                resolve(false);
            }));
        });
    }
    ShowInterstitalAd() {
        if (!this._isInterstitialLoaded) {
            console.error("插页广告尚未加载好");
            return;
        }
        this._intersitialAd.show();
    }

    GetFromAppId(): string {
        if (this.lauchOption.referrerInfo == null) {
            return null;
        }
        if (StringEx.IsNullOrEmpty(this.lauchOption.referrerInfo.appId)) {
            return null;
        }
        return this.lauchOption.referrerInfo.appId;
    }

    /**
     * 小游戏回到前台的事件
     */
    protected _OnShow(res: LTGame.LaunchOption) {
        console.log(LTPlatform.platformStr, "OnShow", res);
        LTPlatform.instance.lauchOption = res;
        LTPlatform.instance._CheckUpdate();

        Awaiters.NextFrame().then(() => {
            if (LTPlatform.instance.onResume) {
                LTPlatform.instance.onResume.runWith(res);
            }
            let cacheOnShow = LTPlatform.instance["_cacheOnShowHandle"];
            if (cacheOnShow) {
                cacheOnShow.run();
                LTPlatform.instance["_cacheOnShowHandle"] = null;
            }
        });


    }

    /**
     * 小游戏退出前台的事件
     */
    protected _OnHide(res: LTGame.LaunchOption) {
        console.log(LTPlatform.platformStr, "OnHide", res);
        if (LTPlatform.instance.onPause) {
            LTPlatform.instance.onPause.runWith(res);
        }
    }

    ShareAppMessage(shareInfo: ShareInfo, onSuccess: Laya.Handler, onFailed: Laya.Handler) {
        console.log("分享消息", shareInfo);

        let shareObj = WXPlatform._WrapShareInfo(shareInfo);
        this._base.shareAppMessage(shareObj);

        if (onSuccess) {
            onSuccess.run();
        }
    }

    LoadSubpackage(name: string, onSuccess: Laya.Handler, onFailed: Laya.Handler, onProgress: Laya.Handler) {
        let loadObj = {};
        loadObj["name"] = name;
        loadObj["success"] = () => {
            console.log("分包加载成功", name);
            if (onSuccess) {
                onSuccess.run();
            }
        };
        loadObj["fail"] = () => {
            console.error("分包加载失败", name);
            if (onFailed) {
                onFailed.run();
            }
        };
        let loadTask = this._base.loadSubpackage(loadObj);
        loadTask.onProgressUpdate((res) => {

            if (Laya.Browser.onMobile) {
                console.log("分包加载进度", res);
            }

            if (onProgress) {
                onProgress.runWith(res.progress / 100);
            }
        });
    }

    RecordEvent(eventId: string, param: object) {
        console.log("记录事件", eventId, param);
        let aldSendEvent = this._base["aldSendEvent"];
        if (aldSendEvent == null) {
            console.error("阿拉丁sdk尚未接入,请检查配置");
            return;
        }
        if (param != null) {
            aldSendEvent(eventId, param);
        } else {
            aldSendEvent(eventId);
        }
    }

    /**
     * 创建分享视频按钮
     * @param x 
     * @param y 
     * @param width 
     * @param height 
     */
    public CreateShareVideoBtn(x: number, y: number, width: number, height: number) {
        let btnObj = {} as any;
        btnObj.style = {
            left: x * this._cacheScreenScale,
            top: y * this._cacheScreenScale,
            height: height * this._cacheScreenScale,
            width: width * this._cacheScreenScale
        };
        btnObj.share = {
            query: {
                tick: 1
            },
            bgm: "",
            timeRange: [0, 60 * 1000]
        };
        if (this._shareVideoBtn == null) {
            this._shareVideoBtn = this._base.createGameRecorderShareButton(btnObj);
        } else {
            this._shareVideoBtn.show();
        }
    }

    /**
     * 隐藏分享视频按钮
     */
    public HideShareVideoBtn() {
        if (this._shareVideoBtn != null) {
            this._shareVideoBtn.hide();
        }
    }

    ShowToast(str: string) {
        this._base.showToast(
            {
                title: str,
                duration: 2000
            }
        );
    }

    OpenGameBox(appIds: string[]) {
        console.error("当前平台", LTPlatform.platformStr, "暂不支持互推游戏盒子");
    }

}