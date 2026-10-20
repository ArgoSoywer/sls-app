"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useReducedMotion } from "framer-motion";
import { Component, useRef, type ReactNode } from "react";
import type { Group } from "three";

interface SceneBoundaryState {
  hasError: boolean;
}

class SceneBoundary extends Component<{ children: ReactNode }, SceneBoundaryState> {
  state: SceneBoundaryState = { hasError: false };

  static getDerivedStateFromError(): SceneBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("The SLS 3D portrait could not be rendered.", error);
  }

  render() {
    if (this.state.hasError) {
      return <div className="character-placeholder" role="img" aria-label="3D portrait unavailable">3D SIGNAL LOST</div>;
    }
    return this.props.children;
  }
}

function HunterModel() {
  const group = useRef<Group>(null);
  const reducedMotion = useReducedMotion();
  useFrame(({ clock }) => {
    if (!group.current || reducedMotion) return;
    const time = clock.getElapsedTime();
    group.current.rotation.y = Math.sin(time * 0.32) * 0.13;
  });

  return (
    <group ref={group} position={[0, -0.94, 0]}>
      <mesh castShadow position={[0, 1.12, 0]}>
        <cylinderGeometry args={[0.34, 0.5, 1.35, 8, 1]} />
        <meshStandardMaterial color="#111525" metalness={0.72} roughness={0.34} />
      </mesh>
      <mesh castShadow position={[0, 1.12, 0.16]}>
        <boxGeometry args={[0.42, 1.16, 0.07]} />
        <meshStandardMaterial color="#141a2c" metalness={0.5} roughness={0.42} />
      </mesh>
      <mesh castShadow position={[0, 2.05, 0]}>
        <sphereGeometry args={[0.31, 24, 24]} />
        <meshStandardMaterial color="#b3a3a0" metalness={0.12} roughness={0.68} />
      </mesh>
      <mesh castShadow position={[0, 2.31, 0.02]} scale={[1.06, 0.48, 1.05]}>
        <sphereGeometry args={[0.31, 20, 16]} />
        <meshStandardMaterial color="#080b14" metalness={0.4} roughness={0.38} />
      </mesh>
      <mesh position={[-0.12, 2.06, 0.276]}>
        <sphereGeometry args={[0.025, 10, 10]} />
        <meshBasicMaterial color="#78dfff" />
      </mesh>
      <mesh position={[0.12, 2.06, 0.276]}>
        <sphereGeometry args={[0.025, 10, 10]} />
        <meshBasicMaterial color="#78dfff" />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.42, 1.57, 0]}>
          <mesh castShadow rotation={[0, 0, side * -0.12]}>
            <capsuleGeometry args={[0.12, 0.72, 5, 8]} />
            <meshStandardMaterial color="#171d30" metalness={0.62} roughness={0.4} />
          </mesh>
          <mesh castShadow position={[0, -0.48, 0.04]}>
            <sphereGeometry args={[0.13, 12, 12]} />
            <meshStandardMaterial color="#a68e91" roughness={0.64} />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={`leg-${side}`} castShadow position={[side * 0.18, 0.22, 0.02]}>
          <capsuleGeometry args={[0.14, 0.55, 5, 8]} />
          <meshStandardMaterial color="#0a0c15" metalness={0.6} roughness={0.44} />
        </mesh>
      ))}
      <pointLight position={[0, 2.5, 1.2]} color="#73dcff" intensity={1.8} distance={3} />
    </group>
  );
}

export default function CharacterScene() {
  return (
    <SceneBoundary>
      <Canvas
        camera={{ position: [0, 1.1, 5.4], fov: 32 }}
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
        aria-label="Stylized 3D hunter portrait"
      >
        <ambientLight intensity={1.4} />
        <directionalLight position={[-2, 4, 3]} intensity={2.2} color="#d7ebff" />
        <pointLight position={[2, 1, -2]} intensity={1.6} color="#7755ff" />
        <HunterModel />
      </Canvas>
    </SceneBoundary>
  );
}
