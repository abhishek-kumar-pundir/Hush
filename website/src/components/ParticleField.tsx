import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/* Floating particles around the AudioCore — like dust or audio energy */

interface ParticleFieldProps {
  count?: number
  radius?: number
  intensity?: number
}

export default function ParticleField({ count = 300, radius = 6, intensity = 1 }: ParticleFieldProps) {
  const pointsRef = useRef<THREE.Points>(null)

  const [positions, sizes] = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const sz = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      // Distribute in a sphere shell
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = radius * (0.5 + Math.random() * 0.5)

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      pos[i * 3 + 2] = r * Math.cos(phi)

      sz[i] = 0.5 + Math.random() * 2
    }
    return [pos, sz]
  }, [count, radius])

  useFrame((state) => {
    if (!pointsRef.current) return
    const t = state.clock.elapsedTime
    pointsRef.current.rotation.y = t * 0.025
    pointsRef.current.rotation.x = Math.sin(t * 0.015) * 0.08

    const mat = pointsRef.current.material as THREE.PointsMaterial
    mat.opacity = 0.4 * intensity
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-size"
          args={[sizes, 1]}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#b6b8d0"
        size={0.03}
        transparent
        opacity={0.4}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  )
}
