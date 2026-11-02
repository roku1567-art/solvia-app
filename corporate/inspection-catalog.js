// 点検項目の一覧（設備 × 最重要／重要 × 親と中の項目）。
// 最重要・重要の分け方は仮の初期値で、本人が設定で変える（d.inspectionCatalog に保存。コードの初期値は変えない）。
// 項目の名前と分け方は法令上の基準ではない。高圧向けの項目は、拠点の受電電圧が高圧（または未入力）のときに出して必須にする。
import {equipmentFor} from './integration-model.js';

export const TIERS=['最重要','重要'];
// 設備の種類。key は設備IDの末尾（siteId:battery など）。パネル類は既存の pv を使い、見せる名前だけ変える。分電盤・その他は拠点ごとに足す。
export const EQUIPMENT_KINDS=[
  {key:'battery',kind:'蓄電池',label:'蓄電池'},
  {key:'pcs',kind:'PCS',label:'PCS'},
  {key:'comm',kind:'通信',label:'通信'},
  {key:'pv',kind:'太陽光',label:'パネル類'},
  {key:'board',kind:'分電盤',label:'分電盤'},
  {key:'other',kind:'その他',label:'その他'},
  {key:'hv',kind:'高圧設備',label:'高圧設備'}
];
export const EXTRA_KINDS=['分電盤','その他'];
// 初期の項目。name は BESS 点検表（Excel）の点検項目名と同じにして、取り込み済みなら同じ記録の鍵を使う。
// children がある親は、中の項目に結果を付け、親の印は中から計算する（親の値は保存しない）。
export const DEFAULT_ITEMS=[
  // 蓄電池
  {name:'BMS警報・イベント',equip:'battery',tier:'最重要'},
  {name:'セル電圧',equip:'battery',tier:'最重要'},
  {name:'セル・ラック温度',equip:'battery',tier:'最重要'},
  {name:'SOC・SOH',equip:'battery',tier:'最重要'},
  {name:'蓄電池・PCSキャビネット外観',equip:'battery',tier:'重要'},
  {name:'換気・空調・フィルタ',equip:'battery',tier:'重要'},
  {name:'冷却ファン・フィルタ',equip:'battery',tier:'重要'},
  {name:'端子・ケーブル・コネクタ',equip:'battery',tier:'重要'},
  {name:'敷地・基礎・フェンス',equip:'battery',tier:'重要'},
  {name:'充放電動作確認',equip:'battery',tier:'重要'},
  {name:'火災検知・消火設備',equip:'battery',tier:'最重要'},
  {name:'非常停止・遮断手段',equip:'battery',tier:'最重要'},
  {name:'監視カメラ・入退室',equip:'battery',tier:'重要'},
  {name:'当日警報・不具合・指摘事項',equip:'battery',tier:'重要'},
  // PCS
  {name:'PCS運転・警報',equip:'pcs',tier:'最重要'},
  {name:'充放電電流・DC電圧',equip:'pcs',tier:'最重要'},
  {name:'有効・無効電力',equip:'pcs',tier:'重要'},
  // 通信
  {name:'BMS・PCS通信',equip:'comm',tier:'最重要'},
  {name:'遠隔監視・アグリゲーター連携',equip:'comm',tier:'最重要'},
  {name:'EMS運転状態',equip:'comm',tier:'重要'},
  // パネル類（中の項目の「配線・接続」は以前の太陽光の記録と同じ鍵）
  {name:'外観',equip:'pv',tier:'最重要',children:['架台・固定','配線・接続','影・雑草','発電量の異常','パネルの割れ・汚れ']},
  // 分電盤
  {name:'外観',equip:'board',tier:'最重要',children:['焦げ・変色・水濡れ','ブレーカーの状態','端子の緩み・発熱跡','表示灯・警報','異音・異臭']},
  // その他（基本形にない設備を足したときの入れ物）
  {name:'外観・動作',equip:'other',tier:'最重要'},
  // 高圧向け（標準では隠す）
  {name:'受電盤・キュービクル',equip:'hv',tier:'重要',hv:true},
  {name:'変圧器',equip:'hv',tier:'重要',hv:true},
  {name:'VCB・LBS・PAS等',equip:'hv',tier:'重要',hv:true},
  {name:'保護継電器・計器',equip:'hv',tier:'重要',hv:true},
  {name:'接地・避雷器・ケーブル',equip:'hv',tier:'重要',hv:true},
  {name:'GIS・ガス圧（該当時）',equip:'hv',tier:'重要',hv:true}
];
const itemId=it=>it.equip+':'+it.name;
// 受電電圧（台帳の kV）で高圧かどうかを決める。0.6kV 以下＝低圧、超える＝高圧、未入力＝不明（不明は高圧の項目も出して注意を促す）。
export function voltageClass(s){const v=s?.voltage;return typeof v==='number'&&Number.isFinite(v)?(v>0.6?'high':'low'):'unknown';}
// 本人の設定を重ねた項目一覧。tier は '最重要'|'重要'|'隠す'。高圧の項目は設定では隠せない（拠点の受電電圧で決める）。
export function catalogItems(d){const cfg=d?.inspectionCatalog||{},tiers=cfg.tiers||{};
  return DEFAULT_ITEMS.map(it=>({...it,id:itemId(it),tier:it.hv&&tiers[itemId(it)]==='隠す'?it.tier:(tiers[itemId(it)]||it.tier)})).filter(it=>it.tier!=='隠す');}

// 拠点にある設備（点検の順番）。通信は「通信あり」の拠点だけ。分電盤は台帳の「分電盤」があり、または点検で足した拠点。その他は点検で足した拠点。高圧は受電電圧が高圧または未入力の拠点。
export function siteEquipment(d,s){const base=equipmentFor(s),has=k=>base.some(e=>e.kind===k),extra=Array.isArray(s?.extraEquipment)?s.extraEquipment:[];
  const out=[];for(const t of EQUIPMENT_KINDS){const present=t.key==='comm'?s?.monitoring?.comm?.mode==='接続':t.key==='hv'?voltageClass(s)!=='low':t.kind==='分電盤'?extra.includes('分電盤')||s?.distributionBoard==='あり':EXTRA_KINDS.includes(t.kind)?extra.includes(t.kind):has(t.kind);if(present)out.push({id:s.id+':'+t.key,key:t.key,kind:t.kind,label:t.label});}return out;}

// 点検の項目（葉）。key は記録の鍵。Excel の BESS 項目がある場合は以前と同じ「siteId:battery:BESSのID」を使う（過去の記録と前回の表示がつながる）。
// 設備がその拠点に無い項目（例：PCS 未登録の拠点の PCS 項目）は、蓄電池の表に入れて消さない。
export function inspectionItems(d,s){
  const eq=siteEquipment(d,s),byKey=Object.fromEntries(eq.map(e=>[e.key,e])),battery=byKey.battery,bess=Array.isArray(d?.bess)?d.bess:[],items=catalogItems(d),all=DEFAULT_ITEMS,out=[];
  const BESS_EQUIP=['battery','pcs','comm','hv'],place=equip=>byKey[equip]||(equip!=='hv'?battery:null);
  const leaf=(home,it,label,child,key,procedure='')=>({key,label,parent:it.id,parentLabel:it.name,child,procedure,equipmentId:home.id,equipKey:home.key,kind:home.kind,tier:it.tier});
  if(bess.length&&battery){
    // Excel の BESS 点検表がある：蓄電池・PCS・通信・高圧の項目はその表から作る。鍵は以前と同じ「siteId:battery:BESSのID」。名前で一覧と照らして設備と最重要／重要を決め、一覧に無い名前は蓄電池の重要に入れる。
    for(const r of bess){const known=all.find(it=>it.name===r.name&&BESS_EQUIP.includes(it.equip)),it=known?items.find(x=>x.id===known.equip+':'+known.name):{id:'battery:'+r.name,name:r.name,equip:'battery',tier:'重要'};if(!it)continue;const home=place(it.equip);if(!home)continue;out.push(leaf(home,it,r.name,false,battery.id+':'+r.id,r.procedure||''));}
  }else for(const it of items.filter(it=>BESS_EQUIP.includes(it.equip))){const home=place(it.equip);if(home)out.push(leaf(home,it,it.name,false,home.id+':'+it.name));}
  // パネル類・分電盤・その他は一覧から（中の項目がある親は中の項目ごと）
  for(const it of items.filter(it=>!BESS_EQUIP.includes(it.equip))){const home=byKey[it.equip];if(!home)continue;for(const child of it.children||[null])out.push(leaf(home,it,child||it.name,!!child,home.id+':'+(child||it.name)));}
  return out;}

// 親ごとの集まり（表の1行）。印：中がすべて正常（対象外を除く）で ○、1つでも不具合ありで ⚠、未確認が残れば 未確認、すべて対象外なら 対象外。
export function parentRows(items,checks={}){const map=new Map();for(const it of items){const k=it.equipmentId+'|'+it.parent;if(!map.has(k))map.set(k,{id:it.parent,label:it.parentLabel,equipmentId:it.equipmentId,tier:it.tier,children:[]});map.get(k).children.push(it);}
  return [...map.values()].map(r=>{const vals=r.children.map(c=>checks[c.key]||''),counted=vals.filter(v=>v!=='対象外'),done=vals.filter(v=>v).length;
    const mark=vals.includes('不具合あり')?'不具合あり':vals.some(v=>!v)?'未確認':counted.length?'正常':'対象外';return {...r,leaf:r.children.length===1&&!r.children[0].child,done,total:vals.length,mark};});}
