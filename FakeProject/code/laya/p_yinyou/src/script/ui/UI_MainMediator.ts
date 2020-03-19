import BaseUIMediator from "../../LTGame/UIExt/FGui/BaseUIMediator";
import UI_Main from "../../ui/Main/UI_Main";
import LTPlatform from "../../LTGame/Platform/LTPlatform";
import UI_UIDemoMediator from "./UI_UIDemoMediator";
import UI_ADDemoMediator from "./UI_ADDemoMediator";

export class UI_MainMediator extends BaseUIMediator<UI_Main> {

    private static _instance;
    public static get instance(): UI_MainMediator {
        if (this._instance == null) {
            this._instance = new UI_MainMediator();
            this._instance._classDefine = UI_Main;
        }
        return this._instance;
    }

    _OnShow() {
        super._OnShow();
        this.ui.m_btn_ad.onClick(this, this._OnClickBtnAd);
        this.ui.m_btn_ui.onClick(this, this._OnClickBtnUI);
    }


    private _OnClickBtnAd() {
        UI_ADDemoMediator.instance.Show();
    }

    private _OnClickBtnUI() {
        UI_UIDemoMediator.instance.Show();
    }

}