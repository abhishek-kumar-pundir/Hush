import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/* Floating acoustic rings that orbit around the AudioCore */

interface AcousticRingsProps {
  count?: number
  radius?: number
  intensity?: number
}

export default function AcousticRings({ count = 4, radius = 2.5, intensity = 1 }: AcousticRingsProps) {
  const groupRef = useRef<THREE.Group>(null)

  const rings = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      radiusMul: 1 + i * 0.35,
      tiltX: (Math.PI / 6) * (i % 2 === 0 ? 1 : -1) + i * 0.15,
      tiltZ: (Math.PI / 8) * (i % 3 === 0 ? -1 : 1),
      speed: 0.12 + i * 0.04,
      opacity: 0.12 - i * 0.02,
      tubeRadius: 0.008 + i * 0.003,
    }))
  }, [count])

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.03
    }
  })

  return (
    <group ref={groupRef}>
      {rings.map((ring) => (
        <RingMesh
          key={ring.id}
          radius={radius * ring.radiusMul}
          tiltX={ring.tiltX}
          tiltZ={ring.tiltZ}
          speed={ring.speed}
          opacity={ring.opacity * intensity}
          tubeRadius={ring.tubeRadius}
        />
      ))}
    </group>
  )
}

interface RingMeshProps {
  radius: number
  tiltX: number
  tiltZ: number
  speed: number
  opacity: number
  tubeRadius: number
}

function RingMesh({ radius, tiltX, tiltZ, speed, opacity, tubeRadius }: RingMeshProps) {
  const ref = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.x = tiltX + Math.sin(state.clock.elapsedTime * speed) * 0.1
      ref.current.rotation.z = tiltZ + Math.cos(state.clock.elapsedTime * speed * 0.7) * 0.05

      const mat = ref.current.material as THREE.MeshBasicMaterial
      mat.opacity = opacity * (0.8 + Math.sin(state.clock.elapsedTime * speed * 2) * 0.2)
    }
  })

  return (
    <mesh ref={ref}>
      <torusGeometry args={[radius, tubeRadius, 12, 64]} />
      <meshBasicMaterial
        color="#b6b8d0"
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}
