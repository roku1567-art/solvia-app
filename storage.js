import {seed,validBackup} from './core.js';
// Read without repairing or overwriting the original. Recovery requires an explicit restore.
export function readStoredState(getStorage,key,now=Date.now()){
 let raw=null;
 try{raw=getStorage().getItem(key);if(raw===null)return {state:seed(now),recovery:null};const state=JSON.parse(raw);if(!validBackup(state))throw Error('invalid-data');return {state,recovery:null};}
 catch{return {state:seed(now),recovery:{raw,reason:raw===null?'ブラウザの保存領域を読み取れませんでした。':'保存データの形式が不完全、または対応していない状態です。'}};}
}
