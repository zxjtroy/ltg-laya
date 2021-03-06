import BaseUIMediator from "../FGui/BaseUIMediator";
import UI_CommonSet from "./UI/LTGame/UI_CommonSet";
import CommonSaveData from "../../Commom/CommonSaveData";
import SetOpenData from "./Data/SetOpenData";

export default class UI_CommonSetMediator extends BaseUIMediator<UI_CommonSet> {

    private static _instance: UI_CommonSetMediator;
    public static get instance(): UI_CommonSetMediator {
        if (this._instance == null) {
            this._instance = new UI_CommonSetMediator();
            this._instance._classDefine = UI_CommonSet;
        }
        return this._instance;
    }

    private _openData: SetOpenData;

    _OnShow() {
        super._OnShow();
        // your code

        this._openData = new SetOpenData();
        if (this._openParam == null) {
            // console.error("请传入OfflineOpenData用于初始化离线奖励界面");
        } else {
            for (let key in this._openParam) {
                this._openData[key] = this._openParam[key];
            }
        }

        this._UpdateUI();

        this.ui.m_view.m_toggle_music.onClick(this, this._OnClickToggleMusic);
        this.ui.m_view.m_toggle_shake.onClick(this, this._OnClickToggleShake);
        this.ui.m_view.m_btn_close.onClick(this, this._OnClickClose);
    }

    private _UpdateUI() {
        this.ui.m_view.m_toggle_music.m_c1.selectedIndex = CommonSaveData.instance.isMusicOn ? 1 : 0;
        this.ui.m_view.m_toggle_shake.m_c1.selectedIndex = CommonSaveData.instance.isShakeOn ? 1 : 0;
    }

    private _OnClickClose() {
        this.Hide();

        if (this._openData.onClose) {
            this._openData.onClose.run();
        }
    }

    private _OnClickToggleMusic() {
        CommonSaveData.instance.isMusicOn = !CommonSaveData.instance.isMusicOn;
        this._UpdateUI();
        CommonSaveData.SaveToDisk();

        if (this._openData.onToggleChange) {
            this._openData.onToggleChange.run();
        }
    }

    private _OnClickToggleShake() {
        CommonSaveData.instance.isShakeOn = !CommonSaveData.instance.isShakeOn;
        this._UpdateUI();
        CommonSaveData.SaveToDisk();

        if (this._openData.onToggleChange) {
            this._openData.onToggleChange.run();
        }
    }

}