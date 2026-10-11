import { useRef } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import AudioCore from './AudioCore'
import AcousticRings from './AcousticRings'
import ParticleField from './ParticleField'
import AudioStreams from './AudioStreams'

/* --------------------------------------------------------------------------
   Scroll-driven camera controller.
   Uses a global scroll progress (0–1) to smoothly interpolate the camera
   through a series of predefined positions (the "camera timeline").
   Reuses vectors to prevent garbage collection stutters.
   -------------------------------------------------------------------------- */

interface CameraKeyframe {
  position: THREE.Vector3
  lookAt: THREE.Vector3
  fov: number
}

const KEYFRAMES: CameraKeyframe[] = [
  // Scene 1 — Hero: wide shot of the orb
  { position: new THREE.Vector3(0, 0.5, 8), lookAt: new THREE.Vector3(0, 0, 0), fov: 50 },
  // Scene 2 — Approach: camera moves closer
  { position: new THREE.Vector3(2, 0.3, 4), lookAt: new THREE.Vector3(0, 0, 0), fov: 45 },
  // Scene 3 — Enter: camera inside the ring system
  { position: new THREE.Vector3(0.5, -0.2, 2.5), lookAt: new THREE.Vector3(0, 0, -1), fov: 55 },
  // Scene 4 — Control: side orbit showing streams
  { position: new THREE.Vector3(-3, 1, 3), lookAt: new THREE.Vector3(0, 0, 0), fov: 48 },
  // Scene 5 — Focus mode: dramatic angle
  { position: new THREE.Vector3(0, 2.5, 4), lookAt: new THREE.Vector3(0, 0, 0), fov: 42 },
  // Scene 6 — Final reveal: pull back wide
  { position: new THREE.Vector3(0, 0, 10), lookAt: new THREE.Vector3(0, 0, 0), fov: 50 },
]

function ScrollCamera({ scrollRef }: { scrollRef: React.RefObject<number> }) {
  const { camera } = useThree()
  const targetPos = useRef(new THREE.Vector3())
  const targetLookAt = useRef(new THREE.Vector3())
  const smoothProgress = useRef(0)

  useFrame((_, delta) => {
    const rawProgress = scrollRef.current || 0
    // Delta-aware smooth interpolation
    const dampFactor = Math.min(1, delta * 6)
    smoothProgress.current += (rawProgress - smoothProgress.current) * dampFactor

    const totalSegments = KEYFRAMES.length - 1
    const rawIndex = smoothProgress.current * totalSegments
    const index = Math.min(Math.floor(rawIndex), totalSegments - 1)
    const t = rawIndex - index

    const from = KEYFRAMES[index]
    const to = KEYFRAMES[index + 1]

    // Smooth cubic interpolation
    const ease = t * t * (3 - 2 * t)

    targetPos.current.lerpVectors(from.position, to.position, ease)
    targetLookAt.current.lerpVectors(from.lookAt, to.lookAt, ease)
    const targetFov = from.fov + (to.fov - from.fov) * ease

    // Damped follow
    camera.position.lerp(targetPos.current, 0.1)
    camera.lookAt(
      camera.position.x + (targetLookAt.current.x - camera.position.x) * 0.35,
      camera.position.y + (targetLookAt.current.y - camera.position.y) * 0.35,
      camera.position.z + (targetLookAt.current.z - camera.position.z) * 0.35
    )

    if ('fov' in camera) {
      const perspCam = camera as THREE.PerspectiveCamera
      perspCam.fov += (targetFov - perspCam.fov) * 0.1
      perspCam.updateProjectionMatrix()
    }
  })

  return null
}

/* --------------------------------------------------------------------------
   Ambient lighting rig (Zero network overhead, high-performance)
   -------------------------------------------------------------------------- */

function LightingRig({ scrollRef }: { scrollRef: React.RefObject<number> }) {
  const spotRef = useRef<THREE.SpotLight>(null)
  const pointRef = useRef<THREE.PointLight>(null)

  useFrame((state) => {
    const p = scrollRef.current || 0
    if (spotRef.current) {
      const t = state.clock.elapsedTime
      spotRef.current.position.x = Math.sin(t * 0.15) * 6
      spotRef.current.position.z = Math.cos(t * 0.15) * 6
      spotRef.current.intensity = 0.8 + p * 0.5
    }
    if (pointRef.current) {
      pointRef.current.intensity = 0.3 + Math.sin(state.clock.elapsedTime * 0.5) * 0.1
    }
  })

  return (
    <>
      <hemisphereLight args={['#2a2d42', '#06070a', 0.6]} />
      <ambientLight intensity={0.1} color="#b6b8d0" />
      <spotLight
        ref={spotRef}
        position={[5, 5, 5]}
        angle={0.4}
        penumbra={0.8}
        color="#b6b8d0"
        intensity={1}
        castShadow={false}
      />
      <pointLight
        ref={pointRef}
        position={[0, 0, 0]}
        color="#8b7ec8"
        intensity={0.3}
        distance={10}
      />
      <pointLight position={[-4, -2, 3]} color="#7be0ca" intensity={0.15} distance={8} />
    </>
  )
}

/* --------------------------------------------------------------------------
   Exported Scene Component
   -------------------------------------------------------------------------- */

interface SceneProps {
  scrollRef: React.RefObject<number>
  activeScene: number
}

function SceneContent({ scrollRef, activeScene }: SceneProps) {
  return (
    <>
      <ScrollCamera scrollRef={scrollRef} />
      <LightingRig scrollRef={scrollRef} />

      {/* Core orb */}
      <AudioCore intensity={0.8} scale={1} />

      {/* Acoustic rings */}
      <AcousticRings intensity={0.7} count={4} radius={2.5} />

      {/* Particles */}
      <ParticleField count={200} radius={6.5} intensity={0.6} />

      {/* Audio streams */}
      <AudioStreams
        intensity={activeScene >= 1 ? 0.9 : 0.3}
        highlightIndex={activeScene >= 3 ? 0 : -1}
      />

      {/* Fog for depth */}
      <fog attach="fog" args={['#050608', 8, 25]} />
    </>
  )
}

export default function Scene3D({ scrollRef, activeScene }: SceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    >
      <Canvas
        camera={{ position: [0, 0.5, 8], fov: 50, near: 0.1, far: 100 }}
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
        style={{ background: 'transparent' }}
      >
        <SceneContent scrollRef={scrollRef} activeScene={activeScene} />
      </Canvas>
    </div>
  )
}
