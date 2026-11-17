import { T } from './forms.js';
export function atmosphere(scene) {
  let seaMat = new T.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      base: { value: new T.Color() },
      shine: { value: new T.Color() },
      haze: { value: new T.Color() },
    },
    vertexShader: `
 varying vec3 point;
 void main(){vec4 world=modelMatrix*vec4(position,1.);point=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader: `varying vec3 point;uniform float time;uniform vec3 base,shine,haze;
 float hash(vec2 v){return fract(sin(dot(v,vec2(127.1,311.7)))*43758.5453);}
 void main(){vec2 p=point.xz;float t=time;float broad=sin(p.y*.77+p.x*.16+t*.47)*.5+.5;vec3 col=mix(base,shine,.05+.095*broad);
 vec2 q=vec2(p.x*.45+sin(p.y*.67)*.72+t*.17,p.y*2.7+sin(p.x*.46+t*.50)*.42);
 vec2 id=floor(q);float r=hash(id);vec2 cell=fract(q)-.5;
 float line=smoothstep(.51,.27,abs(cell.x)/(r*.72+.18))*smoothstep(.21,.07,abs(cell.y+sin(cell.x*5.+r)*.10));
 line*=.64+.36*smoothstep(-1.,1.,sin(p.x*3.+r*7.+t*.28));float flick=.53+.47*sin(t*1.1+r*25.);col=mix(col,shine,line*flick*(.19+.53*r));
 float dist=distance(cameraPosition,point);col=mix(col,haze,smoothstep(25.,84.,dist)*.80);gl_FragColor=vec4(col,1.);
 #include <colorspace_fragment>
 }`,
  });
  let sea = new T.Mesh(new T.PlaneGeometry(310, 240), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(28, -0.045, -15);
  scene.add(sea);
  let skyMat = new T.ShaderMaterial({
    side: T.BackSide,
    depthWrite: false,
    uniforms: { top: { value: new T.Color() }, bottom: { value: new T.Color() } },
    vertexShader: `varying vec3 ray;void main(){ray=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec3 ray;uniform vec3 top,bottom;void main(){vec3 r=normalize(ray);float k=smoothstep(-.035,.21,r.y);vec3 c=mix(bottom,top,k);float d=length(r-normalize(vec3(-.49,.26,-.89)));c=mix(c,vec3(1.,.88,.59),.38*exp(-d*9.)+.60*(1.-smoothstep(.069,.073,d)));gl_FragColor=vec4(c,1.);
 #include <colorspace_fragment>
 }`,
  });
  let sky = new T.Mesh(new T.SphereGeometry(145, 40, 20), skyMat);
  sky.renderOrder = -4;
  scene.add(sky);
  return {
    set(cfg) {
      skyMat.uniforms.top.value.set(cfg.sky[0]);
      skyMat.uniforms.bottom.value.set(cfg.sky[1]);
      seaMat.uniforms.base.value.set(cfg.sea[0]);
      seaMat.uniforms.shine.value.set(cfg.sea[1]);
      seaMat.uniforms.haze.value.set(cfg.sky[1]);
      scene.fog = new T.FogExp2(cfg.sky[1], 0.013);
    },
    update(t, cam) {
      seaMat.uniforms.time.value = t;
      sky.position.copy(cam.position);
    },
  };
}
export function makeShadow(scene) {
  const mat = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader:
      'varying vec2 p;void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:
      'varying vec2 p;void main(){float d=length((p-.5)*2.);gl_FragColor=vec4(.12,.16,.14,(1.-smoothstep(.14,1.,d))*.28);}',
  });
  let shadow = new T.Mesh(new T.PlaneGeometry(1.3, 1.45), mat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.renderOrder = 2;
  scene.add(shadow);
  return shadow;
}
