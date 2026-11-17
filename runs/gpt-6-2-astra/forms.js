import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export { T };
const cube = new T.BoxGeometry(),
  ball = new T.SphereGeometry(1, 20, 14),
  cache = new Map();
const paint = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: T.DoubleSide });
export function group(parent, x = 0, y = 0, z = 0) {
  let g = new T.Group();
  parent.add(g);
  g.position.set(x, y, z);
  return g;
}
function tapered(top, bottom, height, sides) {
  let key = [top, bottom, height, sides].join();
  if (!cache.has(key)) cache.set(key, new T.CylinderGeometry(top, bottom, height, sides));
  return cache.get(key);
}
export function form(p, geo, c, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
  let m = new T.Mesh(geo, paint);
  m.userData.color = c;
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  p.add(m);
  return m;
}
export const box = (p, c, x, y, z, w, h, d) => form(p, cube, c, x, y, z, w, h, d);
export const oval = (p, c, x, y, z, w, h, d) => form(p, ball, c, x, y, z, w, h, d);
export const tube = (p, c, x, y, z, r1, r2, h, n = 12) => form(p, tapered(r1, r2, h, n), c, x, y, z);
export function rod(p, c, a, b, r, r2 = r) {
  const u = new T.Vector3(...a),
    v = new T.Vector3(...b),
    d = v.clone().sub(u);
  const m = tube(p, c, (u.x + v.x) / 2, (u.y + v.y) / 2, (u.z + v.z) / 2, r2, r, d.length(), 8);
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
  return m;
}
export function ring(p, c, x, y, z, r, thick) {
  return form(p, new T.TorusGeometry(r, thick, 8, 24), c, x, y, z);
}
export function triangles(p, c, verts) {
  let g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(verts, 3));
  g.computeVertexNormals();
  return form(p, g, c);
}
export function face(p, c, a, b, d, e) {
  return triangles(p, c, [...a, ...b, ...d, ...a, ...d, ...e]);
}
export function bake(p) {
  let geometries = [];
  p.updateWorldMatrix(true, true);
  const inverse = p.matrixWorld.clone().invert();
  const remove = [];
  const shade = new T.Color();
  p.traverse((m) => {
    if (!m.isMesh || m.userData.color === undefined) return;
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal') g.deleteAttribute(a);
    g.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse, m.matrixWorld));
    shade.set(m.userData.color);
    const rgb = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < rgb.length; i += 3) shade.toArray(rgb, i);
    g.setAttribute('color', new T.BufferAttribute(rgb, 3));
    geometries.push(g);
    remove.push(m);
  });
  if (!geometries.length) return;
  const geometry = mergeGeometries(geometries);
  remove.forEach((m) => m.removeFromParent());
  p.add(new T.Mesh(geometry, paint));
}
export function label(p, text, x, y, z, w, h, bg, fg, font = 'bold') {
  let c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  let ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 3;
  ctx.strokeRect(7, 7, 498, 114);
  ctx.fillStyle = fg;
  ctx.font = font + ' 69px Georgia';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(text, 256, 66, 470);
  let map = new T.CanvasTexture(c);
  map.colorSpace = T.SRGBColorSpace;
  let m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map }));
  p.add(m);
  m.position.set(x, y, z);
  return m;
}
export function rng(seed) {
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
