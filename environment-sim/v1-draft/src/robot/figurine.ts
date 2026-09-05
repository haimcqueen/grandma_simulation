import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export async function loadFigurine(height = 1.55) {
  const { scene } = await new GLTFLoader().loadAsync('/robot/grandmother.glb')
  const bounds = new THREE.Box3().setFromObject(scene)
  const size = bounds.getSize(new THREE.Vector3())
  if (!Number.isFinite(size.y) || size.y <= 0) throw new Error('Figurine has no measurable height')
  const scale = height / size.y
  const center = bounds.getCenter(new THREE.Vector3())
  scene.scale.setScalar(scale)
  scene.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale)
  scene.traverse(object => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true
      object.receiveShadow = true
    }
  })
  const root = new THREE.Group()
  root.name = 'grandmother-figurine'
  root.add(scene)
  return root
}
