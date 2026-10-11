import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/* Audio stream paths — glowing tube lines representing individual browser tab audio */

interface AudioStreamProps {
  streams?: StreamConfig[]
  intensity?: number
  highlightIndex?: number
}

interface StreamConfig {
  color: string
  startPos: [number, number, number]
  endPos: [number, number, number]
  amplitude: number
  frequency: number
  phase: number
}

const DEFAULT_STREAMS: StreamConfig[] = [
  { color: '#7be0ca', startPos: [-4, 1.5, 0], endPos: [0, 0, 0], amplitude: 0.5, frequency: 2, phase: 0 },
  { color: '#b6b8d0', startPos: [-3, -1.2, 1], endPos: [0, 0, 0], amplitude: 0.4, frequency: 3, phase: 1 },
  { color: '#8b7ec8', startPos: [4, 0.8, -0.5], endPos: [0, 0, 0], amplitude: 0.6, frequency: 1.5, phase: 2 },
  { color: '#e28d98', startPos: [3, -1.5, 1.5], endPos: [0, 0, 0], amplitude: 0.3, frequency: 2.5, phase: 0.5 },
  { color: '#7bc8e0', startPos: [-2, 2, -1.5], endPos: [0, 0, 0], amplitude: 0.45, frequency: 1.8, phase: 1.5 },
]

export default function AudioStreams({ streams = DEFAULT_STREAMS, intensity = 1, highlightIndex = -1 }: AudioStreamProps) {
  return (
    <group>
      {streams.map((stream, i) => (
        <StreamLine
          key={i}
          config={stream}
          intensity={intensity}
          highlighted={i === highlightIndex}
          index={i}
        />
      ))}
    </group>
  )
}

interface StreamLineProps {
  config: StreamConfig
  intensity: number
  highlighted: boolean
  index: number
}

function StreamLine({ config, intensity, highlighted }: StreamLineProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const segmentCount = 64

  const curve = useMemo(() => {
    const start = new THREE.Vector3(...config.startPos)
    const end = new THREE.Vector3(...config.endPos)
    const mid = start.clone().lerp(end, 0.5)
    mid.y += config.amplitude * 2
    mid.z += config.amplitude

    return new THREE.QuadraticBezierCurve3(start, mid, end)
  }, [config])

  useFrame((state) => {
    if (!meshRef.current) return
    const mat = meshRef.current.material as THREE.MeshBasicMaterial
    const t = state.clock.elapsedTime

    const breathe = 0.6 + Math.sin(t * config.frequency + config.phase) * 0.4
    const targetOpacity = highlighted ? 0.9 : breathe * 0.35
    mat.opacity += (targetOpacity * intensity - mat.opacity) * 0.1
  })

  return (
    <mesh ref={meshRef}>
      <tubeGeometry args={[curve, segmentCount, highlighted ? 0.025 : 0.012, 8, false]} />
      <meshBasicMaterial
        color={config.color}
        transparent
        opacity={0.3 * intensity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}
