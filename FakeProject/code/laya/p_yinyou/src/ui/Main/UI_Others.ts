/** This is an automatically generated class by FairyGUI. Please do not modify it. **/



export default class UI_Others extends fgui.GComponent {

	public m_title:fgui.GTextField;
	public m_btn_back:fgui.GButton;
	public m_btn_share:fgui.GButton;
	public m_btn_othergame:fgui.GButton;

	public static URL:string = "ui://kk7g5mmmx62bf";

	public static createInstance():UI_Others {
		return <UI_Others><any>(fgui.UIPackage.createObject("Main","Others"));
	}

	public constructor() {
		super();
	}

	protected onConstruct(): void {
		this.m_title = <fgui.GTextField><any>(this.getChildAt(1));
		this.m_btn_back = <fgui.GButton><any>(this.getChildAt(2));
		this.m_btn_share = <fgui.GButton><any>(this.getChildAt(3));
		this.m_btn_othergame = <fgui.GButton><any>(this.getChildAt(4));
	}
}