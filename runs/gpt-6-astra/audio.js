// All sounds and the small, changing score are synthesised here. No samples.
export class Sound {
  constructor(){this.ctx=null;this.enabled=true;this.beat=0;this.clock=0;this.course=0;this.voices=0;this.purrClock=0;}
  async start(){try{if(!this.ctx){this.ctx=new (window.AudioContext||window.webkitAudioContext)();this.master=this.ctx.createGain();this.master.gain.value=.32;this.master.connect(this.ctx.destination);this.delay=this.ctx.createDelay(.6);this.delay.delayTime.value=.24;const feedback=this.ctx.createGain();feedback.gain.value=.19;this.delay.connect(feedback);feedback.connect(this.delay);this.delay.connect(this.master);}await this.ctx.resume();}catch{}}
  toggle(){this.enabled=!this.enabled;if(this.ctx)this.master.gain.setTargetAtTime(this.enabled?.32:0,this.ctx.currentTime,.08);return this.enabled;}
  tone(freq,duration=.3,vol=.12,type='sine',slide=0,delay=0){if(!this.ctx||!this.enabled)return;const t=this.ctx.currentTime+delay,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide),t+duration);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(this.master);if(type==='sine')g.connect(this.delay);o.start(t);o.stop(t+duration+.05);}
  noise(duration=.1,vol=.07,filter=1200){if(!this.ctx||!this.enabled)return;const c=this.ctx,n=Math.ceil(c.sampleRate*duration),buf=c.createBuffer(1,n,c.sampleRate),d=buf.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=buf;f.type='lowpass';f.frequency.value=filter;g.gain.value=vol;s.connect(f);f.connect(g);g.connect(this.master);s.start();}
  meow(pitch=1){this.tone(550*pitch,.28,.13,'triangle',260*pitch);this.tone(790*pitch,.38,.09,'triangle',-320*pitch,.18);}
  jump(){this.tone(240,.2,.05,'sine',220);this.noise(.06,.025,600);}
  land(){this.noise(.1,.07,400);}
  swat(){this.noise(.13,.08,2300);this.tone(180,.08,.06,'triangle',-90);}
  pickup(){this.tone(660,.18,.07);this.tone(990,.3,.06,'sine',0,.07);}
  serve(){[392,494,587,784].forEach((f,i)=>this.tone(f,.65,.09,'sine',0,i*.1));}
  bell(){[880,1320,1760].forEach((f,i)=>this.tone(f,1.3-i*.2,.1/(i+1),'sine',0,i*.06));}
  step(speed){this.noise(.04,.015+speed*.002,500);}
  update(dt,active,stage,purring=false){if(!this.ctx||!active)return;this.purrClock-=dt;if(purring&&this.purrClock<=0){this.purrClock=.12;this.tone(64,.2,.045,'triangle',-12);this.noise(.13,.025,170);}this.course=stage;this.clock-=dt;if(this.clock>0)return;this.clock=.29;const b=this.beat++,bar=Math.floor(b/16)%4;const chords=[[196,247,294],[165,220,262],[175,220,294],[147,196,247]];const chord=chords[bar];if(b%4===0)this.tone(chord[(b/4)%3|0]/2,.9,.05,'triangle');const melody=[2,-1,1,0,-1,1,2,-1,3,2,-1,1,0,-1,1,-1];const note=melody[b%16];if(note>=0)this.tone(note===3?chord[0]*4:chord[note]*2,.6,.035+(stage*.006));if(stage>0&&b%2===0)this.noise(.035,.012,3500);if(stage>1&&b%8===4)this.tone(chord[1],.8,.04,'triangle');}
}
