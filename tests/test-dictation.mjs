import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match=>match[1]);
const inlineApp=scripts.find(script=>script.includes("const STORAGE_KEY"));
if(!inlineApp) throw new Error('No se encontró el código principal de la aplicación.');
const appScript=inlineApp.replace(
  /\}\)\(\);\s*$/,
  `globalThis.__dictationTest={
    createSession,startDictation,stopDictation,isDictating,getPath,analyzeTranscript,applySummaryReview,
    detectTranscriptLanguage,
    hasReview(){return Boolean(summaryReview);},
    useSession(value){session=value;view='session';currentStepId='apertura';}
  };})();`
);

let recognitionInstance=null;
class RecognitionMock{
  constructor(){recognitionInstance=this;}
  start(){this.started=true;}
  stop(){this.onend?.();}
  abort(){this.onend?.();}
}

const handlers={};
const classList={add(){},remove(){},toggle(){},contains(){return false;}};
const generic={
  value:'',textContent:'',innerHTML:'',dataset:{},style:{},classList,disabled:false,
  addEventListener(type,fn){handlers[type]=fn;},
  querySelector(){return null;},
  querySelectorAll(){return [];},
  setAttribute(){},
  getAttribute(){return null;},
  appendChild(){},
  remove(){},
  focus(){},
  closest(){return null;}
};
const label={textContent:'Propósito de esta sesión'};
const container={...generic,querySelector(){return label;}};
const field={
  ...generic,
  tagName:'TEXTAREA',
  value:'Texto previo',
  dataset:{path:'opening.purpose'},
  closest(){return container;}
};
const app={
  ...generic,
  addEventListener(type,fn){handlers[`app:${type}`]=fn;},
  querySelector(){return null;},
  querySelectorAll(selector){return selector==='[data-path]'?[field]:[];}
};
const elements=new Map();
for(const id of ['voiceDock','voiceDockScope','voiceDockTime','voiceStop','voiceDiscard','voiceLanguageMode','voiceLanguageStatus','toast','live','importFile','summaryModal','summaryTranscript','summaryResult','summarySignals','summaryWordCount']){
  elements.set(id,{...generic,dataset:{}});
}
const document={
  body:generic,
  hidden:false,
  getElementById(id){return id==='app'?app:(elements.get(id)||generic);},
  createElement(){return {...generic,dataset:{}};},
  addEventListener(){},
  querySelectorAll(){return [];}
};
const storage=new Map();
const localStorage={
  getItem(key){return storage.get(key)||null;},
  setItem(key,value){storage.set(key,String(value));},
  removeItem(key){storage.delete(key);}
};
const window={
  webkitSpeechRecognition:RecognitionMock,
  addEventListener(){},
  dispatchEvent(){},
  scrollTo(){}
};
class CustomEventMock{constructor(type,options={}){this.type=type;this.detail=options.detail;}}
const context={
  console,document,localStorage,window,Blob,URL,
  navigator:{language:'es-CO'},
  Date,Intl,Math,JSON,CustomEvent:CustomEventMock,structuredClone,setTimeout,clearTimeout,setInterval,clearInterval,
  confirm(){return true;},
  alert(message){throw new Error(message);}
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(appScript,context,{filename:'app.js'});

const session=context.__dictationTest.createSession('regular');
session.dictation.consent=true;
context.__dictationTest.useSession(session);
context.__dictationTest.startDictation('opening.purpose');
assert.equal(context.__dictationTest.isDictating(),true);
assert.equal(recognitionInstance.lang,'es-CO');
assert.equal(recognitionInstance.continuous,true);

const interruptedRecognition=recognitionInstance;
interruptedRecognition.onend();
assert.equal(context.__dictationTest.isDictating(),true,'Un cierre automático del navegador terminó toda la sesión.');
await new Promise(resolve=>setTimeout(resolve,250));
assert.notEqual(recognitionInstance,interruptedRecognition,'El reconocimiento no se reanudó después del corte.');
assert.equal(recognitionInstance.lang,'en-US','El modo automático no alternó el idioma después de un ciclo sin texto.');

const spoken='El equipo avanzó con claridad durante la semana. Acordamos revisar las prioridades cada lunes. Jaime will send the document before Friday. The next step is to review priorities in our next session. Queda pendiente conversar sobre la carga de trabajo.';
const finalResult=[{transcript:spoken}];
finalResult.isFinal=true;
recognitionInstance.onresult({resultIndex:0,results:[finalResult]});
assert.equal(field.value,`Texto previo\n${spoken}`);
assert.equal(context.__dictationTest.getPath(session,'opening.purpose'),field.value);
assert.equal(context.__dictationTest.detectTranscriptLanguage('Acordamos revisar esto durante la próxima sesión.'),'es');
assert.equal(context.__dictationTest.detectTranscriptLanguage('We agreed to review this during the next session.'),'en');
assert.equal(context.__dictationTest.detectTranscriptLanguage('Acordamos el siguiente paso and we will review it next week.'),'mixed');
context.__dictationTest.stopDictation(false);
assert.equal(context.__dictationTest.isDictating(),false);
assert.equal(context.__dictationTest.hasReview(),true);
const localSummary=elements.get('summaryResult').value;
assert(localSummary.includes('Acordamos revisar las prioridades cada lunes.'),'El resumen no priorizó el acuerdo explícito.');
assert(localSummary.length<spoken.length,'El resumen no redujo la transcripción.');
context.__dictationTest.applySummaryReview('summary');
assert.equal(context.__dictationTest.hasReview(),false);
assert(field.value.includes('Acordamos revisar las prioridades cada lunes.'));
assert(!field.value.includes('El equipo avanzó con claridad durante la semana.'),'Guardar resumen conservó toda la transcripción.');

const savedBeforeCancel=field.value;
context.__dictationTest.startDictation('opening.purpose');
const discardedResult=[{transcript:'Este texto debe descartarse.'}];
discardedResult.isFinal=true;
recognitionInstance.onresult({resultIndex:0,results:[discardedResult]});
context.__dictationTest.stopDictation(true);
assert.equal(field.value,savedBeforeCancel);
assert.equal(context.__dictationTest.getPath(session,'opening.purpose'),savedBeforeCancel);

console.log('OK: continuidad tras cortes, detección ES/EN, resumen local, guardado y cancelación verificados.');
