// 技術蔵（別アプリ）への入口。URLはリポジトリに書かず、この端末のブラウザ内にだけ保存する（業務データ・バックアップには含めない）。
const KEY='solvia-vault-url-v1';
// https のURLだけを受け付ける（ログイン情報を含むURLは不可）。
export function validVaultUrl(v){try{const u=new URL(String(v||'').trim());return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}}
export function vaultUrl(){try{const v=localStorage.getItem(KEY)||'';return validVaultUrl(v)?v:'';}catch{return '';}}
export function saveVaultUrl(v){const s=String(v||'').trim();if(!s){localStorage.removeItem(KEY);return '';}if(!validVaultUrl(s))throw Error('https:// で始まるURLを入力してください');const url=new URL(s).href;localStorage.setItem(KEY,url);return url;}
const attr=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
// 「その他」の入口。未設定なら設定への案内を出し、リンクを無反応のまま置かない。
export function vaultEntry(){const url=vaultUrl();return url?`<a href="${attr(url)}" target="_blank" rel="noopener" data-vault-link><b>技術蔵 ↗</b><small>資料室への入口・URLはこの端末だけに保存</small></a><button data-vault-setup><b>技術蔵の入口</b><small>設定済み・変更／解除</small></button>`:`<button data-vault-setup data-vault-unset><b>技術蔵（未設定）</b><small>入口のURLを設定（この端末だけに保存。端末を替えたら入れ直し）</small></button>`;}
export function vaultForm(){const url=vaultUrl();return `<form id="vault-form"><p>技術蔵（電気保安の資料室・別アプリ）を開くURLです。この端末のブラウザの中にだけ保存し、バックアップや業務データには含めません。別の端末では、もう一度設定してください。</p><label>技術蔵のURL<input name="url" type="url" inputmode="url" autocomplete="off" placeholder="https://" value="${attr(url)}"></label><div class="form-footer"><button class="primary" type="submit">保存</button>${url?'<button type="submit" name="clear" value="1">設定を解除</button>':''}</div></form>`;}
