// 立上げ準備の「おすすめの追加項目」。Excel（本人の予測）に足りなさそうな準備の候補。
// 法令上の要否や数値は決めない（確認先は監督部・消防・保険会社など）。足すかどうかは本人が選び、既存の項目は消さない。
export const SUGGESTED_TASKS=[
 {category:'監督部事前相談',name:'法人担当への相談の段取り',deliverable:'講習・訓練の修了後、個人の実務経歴で相談した担当の方から法人担当を紹介してもらう。相談で聞くことの一覧を作る',authority:'東北支部 電力安全課（要確認）'},
 {category:'法人体制',name:'定款・事業目的の確認',deliverable:'会社の事業目的に電気保安の業務が入っているか、新しい部署か別会社かを確認',authority:'会社の総務・法務（要確認）'},
 {category:'測定器',name:'測定器の校正の出し先と周期',deliverable:'メーカーか校正事業者に出すか、周期（例：年1回）、校正証明書の保管、校正中の予備器を決める',authority:'メーカー・校正事業者・監督部（要確認）'},
 {category:'業務区域',name:'車両と駆付けの拠点',deliverable:'点検・緊急時に使う車両、測定器の置き場所、駆付けの出発地を決める',authority:'社内（要確認）'},
 {category:'契約',name:'賠償責任保険の加入',deliverable:'点検中の事故や見落としに備える保険の範囲と金額を確認',authority:'保険会社（要確認）'},
 {category:'契約',name:'料金表・見積の基準',deliverable:'点数・点検頻度・移動距離などから料金を決める基準を作る',authority:'社内・営業（要確認）'},
 {category:'蓄電池',name:'監視データとアグリゲーターとの取り決め',deliverable:'EMS・BMSのデータの受け取り方、警報が出たときの連絡順と責任の分け方を決める',authority:'アグリゲーター・設置者（要確認）'},
 {category:'届出（消防など）',name:'蓄電池の消防の届出の要否確認',deliverable:'蓄電池の容量などで火災予防条例の届出が要るかを事業場ごとに確認',authority:'所轄の消防本部（要確認）'},
 {category:'運用',name:'使用前の検査・立会いの体制',deliverable:'運転開始前の検査を自社で行うか立ち会うか、記録の残し方を決める',authority:'監督部・施工会社（要確認）'},
 {category:'文書管理',name:'記録とデータの守り方',deliverable:'点検記録・写真・個人情報の保存先、バックアップ、端末をなくしたときの対応を決める',authority:'社内（要確認）'}];
export const newSuggestions=d=>SUGGESTED_TASKS.filter(t=>!d.tasks.some(x=>String(x.name||'').trim()===t.name));
