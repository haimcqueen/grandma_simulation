import * as THREE from "three";
/** Stylized fictional resident. Mobility comes from the explicit profile, not appearance. */
export function createResident() {
  const root = new THREE.Group();
  root.name = "resident-01";
  const material = (color: number) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.86 });
  const skin = material(0xc58f70),
    shirt = material(0x3f766b),
    trousers = material(0x34463f),
    hair = material(0xe6dfd4),
    shoes = material(0x252f2c);
  const part = (
    geometry: THREE.BufferGeometry,
    surface: THREE.Material,
    position: number[],
    parent: THREE.Object3D = root,
  ) => {
    const mesh = new THREE.Mesh(geometry, surface);
    mesh.position.fromArray(position);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  part(new THREE.CapsuleGeometry(0.21, 0.38, 6, 12), shirt, [0, 1.05, 0]);
  part(new THREE.SphereGeometry(0.16, 16, 12), skin, [0, 1.5, 0.015]);
  const cap = part(
    new THREE.SphereGeometry(0.166, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.64),
    hair,
    [0, 1.53, 0],
  );
  cap.rotation.x = -0.2;
  part(new THREE.SphereGeometry(0.065, 12, 8), hair, [0, 1.55, -0.14]);
  part(new THREE.SphereGeometry(0.034, 10, 8), skin, [0, 1.5, 0.168]);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.85, 0.85),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: `varying vec2 coordinate; void main() { coordinate = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec2 coordinate; void main() { float opacity = 0.24 * (1.0 - smoothstep(0.0, 1.0, length(coordinate))); gl_FragColor = vec4(0.08, 0.10, 0.08, opacity); }`,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.035;
  root.add(shadow);
  const limbs: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.105, 0.82, 0);
    root.add(leg);
    limbs.push(leg);
    part(
      new THREE.CapsuleGeometry(0.075, 0.49, 6, 10),
      trousers,
      [0, -0.32, 0],
      leg,
    );
    part(
      new THREE.BoxGeometry(0.15, 0.09, 0.26),
      shoes,
      [0, -0.765, 0.05],
      leg,
    );
    const arm = new THREE.Group();
    arm.position.set(side * 0.25, 1.25, 0);
    root.add(arm);
    limbs.push(arm);
    part(
      new THREE.CapsuleGeometry(0.064, 0.32, 6, 10),
      shirt,
      [0, -0.2, 0],
      arm,
    );
    part(new THREE.SphereGeometry(0.061, 10, 8), skin, [0, -0.44, 0], arm);
  }
  return {
    root,
    animate(distance: number, walking: boolean) {
      const swing = walking ? Math.sin(distance * 9) * 0.35 : 0;
      limbs[0].rotation.x = swing;
      limbs[2].rotation.x = -swing;
      limbs[1].rotation.x = -swing * 0.7;
      limbs[3].rotation.x = swing * 0.7;
    },
  };
}
