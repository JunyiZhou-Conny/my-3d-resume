import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

const [referencePath, characterPath, stickersPath, outputPath, calibrationPath = fileURLToPath(new URL('./conny-scene.json', import.meta.url))] = process.argv.slice(2)
assert(referencePath && characterPath && stickersPath && outputPath,
  'Usage: node scripts/build-reference-scene.mjs reference.glb character.glb stickers-directory output.glb [calibration.json]')
assert(![referencePath, characterPath].map(p => path.resolve(p)).includes(path.resolve(outputPath)), 'Output must not overwrite a source')
await MeshoptDecoder.ready
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const clone = value => structuredClone(value)
const align = n => (n + 3) & ~3
const types = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }
const arrays = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }

function readGlb(filename) {
  const bytes = fs.readFileSync(filename)
  assert.equal(bytes.readUInt32LE(0), 0x46546c67)
  assert.equal(bytes.readUInt32LE(4), 2)
  assert.equal(bytes.readUInt32LE(8), bytes.length)
  const length = bytes.readUInt32LE(12)
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a)
  assert.equal(bytes.readUInt32LE(24 + length), 0x004e4942)
  return { filename, bytes, json: JSON.parse(bytes.subarray(20, 20 + length)), bin: bytes.subarray(28 + length), decoded: new Map() }
}

function viewBytes(source, index) {
  if (source.decoded.has(index)) return source.decoded.get(index)
  const view = source.json.bufferViews[index]
  const ext = view.extensions?.EXT_meshopt_compression
  let bytes
  if (ext) {
    assert.equal(ext.buffer, 0)
    bytes = new Uint8Array(ext.count * ext.byteStride)
    MeshoptDecoder.decodeGltfBuffer(bytes, ext.count, ext.byteStride,
      source.bin.subarray(ext.byteOffset ?? 0, (ext.byteOffset ?? 0) + ext.byteLength), ext.mode, ext.filter)
  } else {
    assert.equal(view.buffer, 0)
    bytes = source.bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)
  }
  source.decoded.set(index, bytes)
  return bytes
}

function accessorArray(source, index) {
  const a = source.json.accessors[index]
  assert(!a.sparse && !a.normalized, 'Sparse or normalized accessors are unsupported')
  const ArrayType = arrays[a.componentType]
  assert(ArrayType && types[a.type], 'Unsupported accessor type')
  const count = types[a.type], size = ArrayType.BYTES_PER_ELEMENT
  const bytes = viewBytes(source, a.bufferView)
  const stride = source.json.bufferViews[a.bufferView].byteStride ?? count * size
  const result = new ArrayType(a.count * count)
  for (let i = 0; i < a.count; i++) {
    const start = (a.byteOffset ?? 0) + i * stride
    const copy = Uint8Array.from(bytes.subarray(start, start + count * size))
    result.set(new ArrayType(copy.buffer), i * count)
  }
  return result
}

const reference = readGlb(referencePath), character = readGlb(characterPath)
const calibration = JSON.parse(fs.readFileSync(calibrationPath, 'utf8'))
const sourceHashes = [reference, character].map(s => sha(s.bytes))
const out = {
  asset: { version: '2.0', generator: 'Conny reference scene composer' },
  scene: 0, scenes: [{ name: 'Conny reference comparison', nodes: [] }],
  nodes: [], cameras: [], animations: [], meshes: [], materials: [], textures: [], images: [], samplers: [],
  accessors: [], bufferViews: [], buffers: [],
  extensionsUsed: ['EXT_meshopt_compression', 'EXT_texture_webp'],
  extensionsRequired: ['EXT_meshopt_compression', 'EXT_texture_webp'],
}
const chunks = [], viewMaps = new Map(), accessorMaps = new Map()
let byteLength = 0, fallbackLength = 0
function append(bytes) {
  const offset = byteLength
  const padded = Buffer.alloc(align(bytes.byteLength))
  padded.set(bytes)
  chunks.push(padded)
  byteLength += padded.length
  return offset
}
function copyView(source, index) {
  const key = `${source.filename}:${index}`
  if (viewMaps.has(key)) return viewMaps.get(key)
  const view = clone(source.json.bufferViews[index]), ext = view.extensions?.EXT_meshopt_compression
  if (ext) {
    assert.equal(ext.buffer, 0)
    ext.byteOffset = append(source.bin.subarray(ext.byteOffset ?? 0, (ext.byteOffset ?? 0) + ext.byteLength))
    view.buffer = 1
    view.byteOffset = fallbackLength
    fallbackLength += align(view.byteLength)
  } else {
    assert.equal(view.buffer, 0)
    view.byteOffset = append(viewBytes(source, index))
  }
  const result = out.bufferViews.push(view) - 1
  viewMaps.set(key, result)
  return result
}
function copyAccessor(source, index) {
  const key = `${source.filename}:${index}`
  if (accessorMaps.has(key)) return accessorMaps.get(key)
  const a = clone(source.json.accessors[index])
  assert(!a.sparse && a.bufferView !== undefined)
  a.bufferView = copyView(source, a.bufferView)
  const result = out.accessors.push(a) - 1
  accessorMaps.set(key, result)
  return result
}
function addFloatAttribute(attribute, position = false) {
  assert(attribute.array instanceof Float32Array)
  const bytes = Buffer.from(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength)
  const bufferView = out.bufferViews.push({ buffer: 0, byteOffset: append(bytes), byteLength: bytes.length, target: 34962 }) - 1
  const a = { bufferView, componentType: 5126, count: attribute.count, type: `VEC${attribute.itemSize}` }
  if (position) {
    a.min = Array.from({ length: 3 }, (_, i) => Infinity)
    a.max = Array.from({ length: 3 }, (_, i) => -Infinity)
    for (let j = 0; j < attribute.count; j++) for (let i = 0; i < 3; i++) {
      a.min[i] = Math.min(a.min[i], attribute.array[j * 3 + i])
      a.max[i] = Math.max(a.max[i], attribute.array[j * 3 + i])
    }
  }
  return out.accessors.push(a) - 1
}

const nodeMap = new Map()
const cameraIndex = reference.json.nodes.findIndex(n => n.name === 'Camera')
const manIndex = reference.json.nodes.findIndex(n => n.name === 'man')
assert(cameraIndex >= 0 && manIndex >= 0)
const originalMan = reference.json.nodes[manIndex]
assert(originalMan.mesh !== undefined && reference.json.nodes.some(n => n.name === 'eye1'),
  'Reference must be the untouched upstream GLB, not a previously assembled scene')
assert.deepEqual(reference.json.scenes[reference.json.scene ?? 0].nodes, [cameraIndex, manIndex])
const anchorIndices = originalMan.children.filter(i => /^focus-(?:[0-5]|works)$/.test(reference.json.nodes[i].name))
assert.equal(anchorIndices.length, 7)
for (const index of [cameraIndex, manIndex, ...anchorIndices]) {
  const node = clone(reference.json.nodes[index])
  delete node.mesh
  delete node.children
  assert(node.skin === undefined)
  if (node.camera !== undefined) {
    node.camera = out.cameras.push(clone(reference.json.cameras[node.camera])) - 1
  }
  nodeMap.set(index, out.nodes.push(node) - 1)
}
out.scenes[0].nodes = [nodeMap.get(cameraIndex), nodeMap.get(manIndex)]
out.nodes[nodeMap.get(manIndex)].children = anchorIndices.map(i => nodeMap.get(i))
assert.deepEqual(reference.json.animations.map(a => a.name).sort(), ['CameraAction', 'manAction'])
for (const animation of reference.json.animations) {
  const result = clone(animation)
  for (const sampler of result.samplers) {
    sampler.input = copyAccessor(reference, sampler.input)
    sampler.output = copyAccessor(reference, sampler.output)
  }
  for (const channel of result.channels) {
    assert(nodeMap.has(channel.target.node), 'Unexpected animated personal mesh')
    channel.target.node = nodeMap.get(channel.target.node)
  }
  out.animations.push(result)
}

const identity = new THREE.Matrix4(), world = new Map()
function visit(index, parent = identity) {
  const node = character.json.nodes[index]
  assert(!node.matrix, 'Matrix-authored source nodes are unsupported')
  const local = new THREE.Matrix4().compose(
    new THREE.Vector3().fromArray(node.translation ?? [0, 0, 0]),
    new THREE.Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
    new THREE.Vector3().fromArray(node.scale ?? [1, 1, 1]))
  const matrix = parent.clone().multiply(local)
  world.set(index, matrix)
  for (const child of node.children ?? []) visit(child, matrix)
}
for (const index of character.json.scenes[character.json.scene ?? 0].nodes) visit(index)
assert.equal(character.json.skins.length, 1)
assert(!character.json.animations?.length)
const skin = character.json.skins[0], inverseBind = accessorArray(character, skin.inverseBindMatrices)
for (let i = 0; i < skin.joints.length; i++) {
  const bind = world.get(skin.joints[i]).clone().multiply(new THREE.Matrix4().fromArray(inverseBind, i * 16))
  assert.deepEqual(bind.elements, identity.elements, 'Source is not at an identity bind pose')
}
out.samplers = clone(character.json.samplers ?? [])
out.images = character.json.images.map(image => {
  assert(image.bufferView !== undefined && !image.uri)
  return { ...clone(image), bufferView: copyView(character, image.bufferView) }
})
out.textures = clone(character.json.textures)
out.materials = clone(character.json.materials)
assert(out.textures.every(t => !t.extensions && t.source < out.images.length))
const fittingIndex = out.nodes.push({ name: 'ConnyFit', translation: calibration.fit.translation,
  scale: Array(3).fill(calibration.fit.scale), children: [] }) - 1
out.nodes[nodeMap.get(manIndex)].children.push(fittingIndex)
let shirt, weightSumError = 0, triangleCount = 0
for (const [index, node] of character.json.nodes.entries()) {
  if (node.mesh === undefined) continue
  assert.deepEqual(world.get(index).elements, identity.elements)
  assert.equal(node.skin, 0)
  const mesh = clone(character.json.meshes[node.mesh])
  assert.equal(mesh.primitives.length, 1)
  const primitive = mesh.primitives[0], attrs = primitive.attributes
  assert(!primitive.targets && (primitive.mode === undefined || primitive.mode === 4))
  assert.deepEqual(Object.keys(attrs).sort(), ['JOINTS_0', 'NORMAL', 'POSITION', 'TEXCOORD_0', 'WEIGHTS_0'])
  const weights = accessorArray(character, attrs.WEIGHTS_0), joints = accessorArray(character, attrs.JOINTS_0)
  for (let i = 0; i < weights.length; i += 4) {
    let sum = 0
    for (let j = 0; j < 4; j++) { assert(joints[i + j] < skin.joints.length && weights[i + j] >= 0); sum += weights[i + j] }
    weightSumError = Math.max(weightSumError, Math.abs(sum - 1))
  }
  assert(weightSumError < 1e-6, 'Non-normalized source weights would change the bind pose')
  if (node.name === 'ConnyShirt') {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(accessorArray(character, attrs.POSITION), 3))
    geometry.setAttribute('normal', new THREE.BufferAttribute(accessorArray(character, attrs.NORMAL), 3))
    geometry.setIndex(new THREE.BufferAttribute(accessorArray(character, primitive.indices), 1))
    shirt = new THREE.Mesh(geometry)
    shirt.updateMatrixWorld(true)
  }
  delete attrs.JOINTS_0
  delete attrs.WEIGHTS_0
  for (const key of Object.keys(attrs)) attrs[key] = copyAccessor(character, attrs[key])
  triangleCount += character.json.accessors[primitive.indices].count / 3
  primitive.indices = copyAccessor(character, primitive.indices)
  const meshIndex = out.meshes.push(mesh) - 1
  out.nodes[fittingIndex].children.push(out.nodes.push({ name: node.name, mesh: meshIndex }) - 1)
}
assert(shirt && out.meshes.length === 3)
const decalReport = []
for (const sticker of calibration.stickers) {
  const position = new THREE.Vector3().fromArray(sticker.position)
  const normal = new THREE.Vector3().fromArray(sticker.normal).normalize()
  const helper = new THREE.Object3D()
  helper.position.copy(position)
  helper.lookAt(position.clone().add(normal))
  helper.rotation.z += THREE.MathUtils.degToRad(sticker.rotation)
  const geometry = new DecalGeometry(shirt, position, helper.rotation, new THREE.Vector3().setScalar(sticker.size))
  const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal'), uv = geometry.getAttribute('uv')
  assert(p.count > 0 && p.count % 3 === 0, `Empty decal: ${sticker.id}`)
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i)
      .addScaledVector(new THREE.Vector3().fromBufferAttribute(n, i).normalize(), calibration.decalOffset)
    p.setXYZ(i, v.x, v.y, v.z)
    uv.setY(i, 1 - uv.getY(i))
  }
  const imageBytes = fs.readFileSync(path.join(stickersPath, sticker.image))
  assert.equal(imageBytes.subarray(0, 4).toString(), 'RIFF')
  assert.equal(imageBytes.subarray(8, 12).toString(), 'WEBP')
  const bufferView = out.bufferViews.push({ buffer: 0, byteOffset: append(imageBytes), byteLength: imageBytes.length }) - 1
  const image = out.images.push({ name: `conny-${sticker.id}`, bufferView, mimeType: 'image/webp' }) - 1
  const texture = out.textures.push({ sampler: 0, extensions: { EXT_texture_webp: { source: image } } }) - 1
  const material = out.materials.push({ name: `ConnySticker-${sticker.id}`, alphaMode: 'BLEND', doubleSided: true,
    pbrMetallicRoughness: { baseColorTexture: { index: texture }, roughnessFactor: 0.5, metallicFactor: 0 } }) - 1
  const mesh = out.meshes.push({ name: `ConnySticker-${sticker.id}`, primitives: [{ attributes: {
    POSITION: addFloatAttribute(p, true), NORMAL: addFloatAttribute(n), TEXCOORD_0: addFloatAttribute(uv),
  }, material }] }) - 1
  out.nodes[fittingIndex].children.push(out.nodes.push({ name: `ConnySticker-${sticker.id}`, mesh }) - 1)
  decalReport.push({ id: sticker.id, triangles: p.count / 3, imageSha256: sha(imageBytes) })
  geometry.dispose()
}
shirt.geometry.dispose()
assert.equal(decalReport.length, 6)
out.buffers = [{ byteLength }, { byteLength: fallbackLength, extensions: { EXT_meshopt_compression: { fallback: true } } }]
const bin = Buffer.concat(chunks), jsonBytes = Buffer.from(JSON.stringify(out))
const jsonChunk = Buffer.alloc(align(jsonBytes.length), 0x20)
jsonChunk.set(jsonBytes)
const glb = Buffer.alloc(12 + 8 + jsonChunk.length + 8 + bin.length)
glb.writeUInt32LE(0x46546c67, 0); glb.writeUInt32LE(2, 4); glb.writeUInt32LE(glb.length, 8)
glb.writeUInt32LE(jsonChunk.length, 12); glb.writeUInt32LE(0x4e4f534a, 16); jsonChunk.copy(glb, 20)
glb.writeUInt32LE(bin.length, 20 + jsonChunk.length); glb.writeUInt32LE(0x004e4942, 24 + jsonChunk.length); bin.copy(glb, 28 + jsonChunk.length)
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, glb)
const assembled = readGlb(outputPath)
assert.deepEqual(out.cameras, [reference.json.cameras[reference.json.nodes[cameraIndex].camera]])
const expectedCamera = { ...reference.json.nodes[cameraIndex], camera: 0 }
assert.deepEqual(out.nodes[nodeMap.get(cameraIndex)], expectedCamera)
const expectedMan = clone(originalMan)
delete expectedMan.mesh
expectedMan.children = [...anchorIndices.map(i => nodeMap.get(i)), fittingIndex]
assert.deepEqual(out.nodes[nodeMap.get(manIndex)], expectedMan)
for (const index of anchorIndices) assert.deepEqual(out.nodes[nodeMap.get(index)], reference.json.nodes[index])
for (let i = 0; i < out.animations.length; i++) {
  const a = out.animations[i], source = reference.json.animations[i]
  assert.deepEqual(a.channels, source.channels.map(c => ({ ...c, target: { ...c.target, node: nodeMap.get(c.target.node) } })))
  for (let j = 0; j < a.samplers.length; j++) {
    assert.equal(a.samplers[j].interpolation, source.samplers[j].interpolation)
    for (const key of ['input', 'output']) {
      assert.deepEqual(accessorArray(assembled, a.samplers[j][key]), accessorArray(reference, source.samplers[j][key]))
      assert.equal(sha(viewBytes(assembled, out.accessors[a.samplers[j][key]].bufferView)),
        sha(viewBytes(reference, reference.json.accessors[source.samplers[j][key]].bufferView)))
    }
  }
}
for (const node of character.json.nodes.filter(n => n.mesh !== undefined)) {
  const original = character.json.meshes[node.mesh].primitives[0]
  const copied = out.meshes.find(m => m.name === character.json.meshes[node.mesh].name).primitives[0]
  for (const key of ['POSITION', 'NORMAL', 'TEXCOORD_0']) {
    assert.deepEqual(accessorArray(character, original.attributes[key]), accessorArray(assembled, copied.attributes[key]))
  }
  assert.deepEqual(accessorArray(character, original.indices), accessorArray(assembled, copied.indices))
}
assert.deepEqual(out.materials.slice(0, character.json.materials.length), character.json.materials)
for (let i = 0; i < character.json.images.length; i++) {
  assert.equal(sha(viewBytes(assembled, out.images[i].bufferView)), sha(viewBytes(character, character.json.images[i].bufferView)))
}
const originalImages = new Set(reference.json.images.map(i => sha(viewBytes(reference, i.bufferView))))
assert(out.images.every(i => !originalImages.has(sha(viewBytes(assembled, i.bufferView)))))
assert(out.nodes.every(n => n.skin === undefined && !/eye/i.test(n.name)))
assert(out.meshes.every(m => m.name.startsWith('Conny') && m.primitives.every(p => !p.attributes.JOINTS_0 && !p.attributes.WEIGHTS_0)))
for (const [i, source] of [reference, character].entries()) assert.equal(sha(fs.readFileSync(source.filename)), sourceHashes[i])
const report = {
  sources: [reference, character].map((s, i) => ({ path: path.resolve(s.filename), sha256: sourceHashes[i] })),
  output: { path: path.resolve(outputPath), bytes: glb.length, sha256: sha(glb) },
  fit: calibration.fit, characterTriangles: triangleCount, decals: decalReport, maxWeightSumError: weightSumError,
  checks: { cameraExact: true, anchorsExact: true, bothAnimationBytesAndTargetsExact: true, sourceRestJointMatricesIdentity: true,
    characterAttributesAndMaterialsExact: true, characterImageBytesExact: true,
    noOriginalPersonalImagesOrGeometry: true, noSkinOrEyeNodes: true, sourceFilesUnchanged: true },
}
fs.writeFileSync(`${outputPath}.report.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
