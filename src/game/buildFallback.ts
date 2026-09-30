import * as THREE from 'three';

/**
 * A procedural chibi cat-girl used ONLY when /public/models/sylvia.glb is missing or fails to load.
 * It uses the same node names the animation system searches for (Head, EarL, EarR, Tail, Hair, Ahoge...),
 * so it exercises layer 2/3 animation and the face overlay exactly like a real model would.
 */
export function buildFallbackSylvia(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'FallbackSylvia';

  const std = (hex: string) => new THREE.MeshStandardMaterial({ color: hex });
  const mesh = (geo: THREE.BufferGeometry, hex: string, name: string) => {
    const m = new THREE.Mesh(geo, std(hex));
    m.name = name;
    return m;
  };
  const CREAM = '#F6F1EA', HAIR = '#EDE8E0', OLIVE = '#5C6B2A', PEACH = '#F3C9A0', BLUE = '#2F5FB0';

  const body = mesh(new THREE.CapsuleGeometry(0.27, 0.32, 8, 16), CREAM, 'Body');
  body.position.set(0, 0.46, 0);
  root.add(body);

  const poncho = mesh(new THREE.CylinderGeometry(0.2, 0.4, 0.42, 20, 1, true), OLIVE, 'Poncho');
  poncho.position.set(0, 0.56, 0);
  (poncho.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  root.add(poncho);
  const collar = mesh(new THREE.TorusGeometry(0.21, 0.05, 8, 20), OLIVE, 'PonchoCollar');
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 0.76, 0);
  root.add(collar);
  for (const y of [0.7, 0.62]) {
    const b = mesh(new THREE.SphereGeometry(0.022, 8, 8), '#e6d9a8', 'Button');
    b.position.set(0, y, 0.34 - (0.7 - y) * 0.2);
    root.add(b);
  }

  const head = new THREE.Group();
  head.name = 'Head';
  head.position.set(0, 1.02, 0);
  head.add(mesh(new THREE.SphereGeometry(0.42, 28, 22), CREAM, 'HeadMesh'));
  root.add(head);

  const hair = new THREE.Group();
  hair.name = 'Hair';
  const cap = mesh(new THREE.SphereGeometry(0.445, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.52), HAIR, 'HairCap');
  cap.rotation.x = -0.18;
  hair.add(cap);
  for (const x of [-0.22, 0, 0.22]) {
    const bang = mesh(new THREE.SphereGeometry(0.12, 12, 10), HAIR, 'Bang');
    bang.scale.set(0.9, 1.25, 0.55);
    bang.position.set(x, 0.24, 0.36);
    bang.rotation.z = -x * 1.2;
    hair.add(bang);
  }
  for (const s of [-1, 1]) {
    const lock = mesh(new THREE.CapsuleGeometry(0.06, 0.34, 6, 10), '#d9d3e4', 'SideLock');
    lock.position.set(s * 0.4, -0.08, 0.06);
    lock.rotation.z = s * 0.1;
    hair.add(lock);
  }
  head.add(hair);

  const ahoge = new THREE.Group();
  ahoge.name = 'Ahoge';
  const ah = mesh(new THREE.TorusGeometry(0.11, 0.016, 6, 14, Math.PI * 1.35), HAIR, 'AhogeMesh');
  ah.position.set(0, 0.11, 0);
  ahoge.add(ah);
  ahoge.position.set(0.02, 0.44, 0.05);
  head.add(ahoge);

  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    ear.name = s < 0 ? 'EarL' : 'EarR';
    const outer = mesh(new THREE.ConeGeometry(0.15, 0.34, 4), HAIR, 'EarOuter');
    outer.position.y = 0.17;
    outer.rotation.y = Math.PI / 4;
    const inner = mesh(new THREE.ConeGeometry(0.09, 0.22, 4), '#fff6f2', 'EarInner');
    inner.position.set(0, 0.14, 0.05);
    inner.rotation.y = Math.PI / 4;
    ear.add(outer, inner);
    ear.position.set(s * 0.26, 0.34, 0);
    ear.rotation.z = -s * 0.38;
    head.add(ear);

    const gem = mesh(new THREE.OctahedronGeometry(0.03, 0), BLUE, s < 0 ? 'EarringL' : 'EarringR');
    gem.scale.y = 1.5;
    gem.position.set(s * 0.4, -0.02, 0.05);
    head.add(gem);
  }

  const tail = new THREE.Group();
  tail.name = 'Tail';
  const tb = mesh(new THREE.CapsuleGeometry(0.08, 0.36, 6, 12), CREAM, 'TailBase');
  tb.position.set(0, 0.24, 0);
  const tt = mesh(new THREE.SphereGeometry(0.11, 12, 10), PEACH, 'TailTip');
  tt.position.set(0, 0.5, 0);
  tail.add(tb, tt);
  tail.position.set(0, 0.28, -0.24);
  tail.rotation.x = -0.6;
  root.add(tail);

  for (const s of [-1, 1]) {
    const paw = mesh(new THREE.SphereGeometry(0.075, 12, 10), CREAM, s < 0 ? 'ArmL' : 'ArmR');
    paw.position.set(s * 0.3, 0.4, 0.12);
    root.add(paw);
    const foot = mesh(new THREE.SphereGeometry(0.11, 14, 10), CREAM, 'Foot');
    foot.scale.set(1, 0.6, 1.4);
    foot.position.set(s * 0.13, 0.07, 0.06);
    root.add(foot);
  }
  return root;
}
