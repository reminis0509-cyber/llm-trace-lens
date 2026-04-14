/**
 * PixelCat — FujiTrace マスコット
 *
 * Step 1: Pixel-perfect trace of reference cat (facing left)
 * Step 2: Mirror on Y-axis (facing right)
 * Step 3: Running animation going right (+X direction)
 *
 * Pure CSS pixel art via box-shadow.
 */

import { useEffect, useState } from 'react';

export type CatState = 'idle' | 'processing' | 'success';

interface Props {
  state?: CatState;
  scale?: number;
}

const S = 1;

// Color palette
const B = '#222222'; // black outline & feet
const W = '#f0f0f0'; // white body
const G = '#c8c8c8'; // grey checker
const P = '#c04040'; // pink/red nose
const T = ''; // transparent

/* ================================================================== */
/*  Step 1: Reference cat — facing LEFT, 16×14 grid                   */
/*  Traced pixel by pixel from reference image                         */
/* ================================================================== */

// Standing pose (reference image — facing left)
const CAT_LEFT: string[][] = [
  //0 1 2 3 4 5 6 7 8 9 A B C D E F
  [T,T,B,B,T,T,T,T,T,T,T,T,T,T,T,T], // 0  left ear tip
  [T,B,B,W,B,T,T,T,T,T,T,T,T,T,T,T], // 1  left ear
  [T,B,W,W,B,B,T,T,T,T,T,T,T,B,T,T], // 2  ear base + tail tip
  [T,T,B,W,W,W,B,B,B,T,T,T,B,W,B,T], // 3  head + tail
  [T,T,B,W,B,W,W,W,W,B,T,B,W,B,T,T], // 4  eye + head + tail
  [T,T,B,W,P,W,W,W,W,W,B,B,B,T,T,T], // 5  nose + body→tail
  [T,T,T,B,W,W,W,W,W,W,W,W,B,T,T,T], // 6  upper body
  [T,T,T,B,W,G,W,G,W,G,W,W,B,T,T,T], // 7  body checker row 1
  [T,T,T,B,G,W,G,W,G,W,G,W,B,T,T,T], // 8  body checker row 2
  [T,T,T,B,W,G,W,G,W,G,W,B,T,T,T,T], // 9  body checker row 3
  [T,T,T,B,B,B,B,B,B,B,B,B,T,T,T,T], // 10 feet (solid black)
  [T,T,T,T,B,B,T,T,T,B,B,T,T,T,T,T], // 11 paws
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T], // 12
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T], // 13
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T], // 14
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T], // 15
];

// Idle frame 2 — tail swish (slightly lower tail position)
const CAT_LEFT_2: string[][] = [
  //0 1 2 3 4 5 6 7 8 9 A B C D E F
  [T,T,B,B,T,T,T,T,T,T,T,T,T,T,T,T], // 0
  [T,B,B,W,B,T,T,T,T,T,T,T,T,T,T,T], // 1
  [T,B,W,W,B,B,T,T,T,T,T,T,T,T,T,T], // 2  no tail tip (lower)
  [T,T,B,W,W,W,B,B,B,T,T,T,T,T,T,T], // 3
  [T,T,B,W,B,W,W,W,W,B,T,T,T,B,T,T], // 4  tail tip here instead
  [T,T,B,W,P,W,W,W,W,W,B,T,B,W,B,T], // 5  tail
  [T,T,T,B,W,W,W,W,W,W,W,B,B,B,T,T], // 6  tail joins body
  [T,T,T,B,W,G,W,G,W,G,W,W,B,T,T,T], // 7
  [T,T,T,B,G,W,G,W,G,W,G,W,B,T,T,T], // 8
  [T,T,T,B,W,G,W,G,W,G,W,B,T,T,T,T], // 9
  [T,T,T,B,B,B,B,B,B,B,B,B,T,T,T,T], // 10
  [T,T,T,T,B,B,T,T,T,B,B,T,T,T,T,T], // 11
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T], // 12
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T], // 13
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T], // 14
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T], // 15
];

/* ================================================================== */
/*  Step 2: Mirror function — flip horizontally (Y-axis symmetry)      */
/* ================================================================== */

function mirrorSprite(sprite: string[][]): string[][] {
  return sprite.map((row) => [...row].reverse());
}

/* ================================================================== */
/*  Step 3: Running animation frames (facing RIGHT)                    */
/*  Cat faces right = mirrored from reference                          */
/*  Running = legs in alternating positions                            */
/* ================================================================== */

// Running frame 1 — legs stretched (front forward, back backward)
const RUN_RIGHT_1: string[][] = [
  //0 1 2 3 4 5 6 7 8 9 A B C D E F
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T], // 0
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T], // 1
  [T,T,B,T,T,T,T,T,T,T,B,B,T,T,T,T], // 2  tail tip + ear
  [T,B,W,B,T,T,T,B,B,B,W,W,W,B,T,T], // 3  tail + head
  [T,T,B,W,B,T,B,W,W,W,W,B,W,B,T,T], // 4  tail + eye
  [T,T,T,B,B,B,W,W,W,W,W,P,W,B,T,T], // 5  body→tail + nose
  [T,T,T,B,W,W,W,W,W,W,W,W,B,T,T,T], // 6  body
  [T,T,T,B,W,W,G,W,G,W,G,W,B,T,T,T], // 7  checker
  [T,T,T,B,W,G,W,G,W,G,W,G,B,T,T,T], // 8  checker
  [T,T,T,T,B,W,G,W,G,W,G,W,B,T,T,T], // 9  checker
  [T,T,T,B,B,B,B,B,B,B,B,B,B,T,T,T], // 10 feet
  [T,T,B,B,T,T,T,T,T,T,T,B,B,T,T,T], // 11 legs stretched
  [T,B,B,T,T,T,T,T,T,T,T,T,B,B,T,T], // 12 legs extended
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T], // 13
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T], // 14
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T], // 15
];

// Running frame 2 — legs tucked under body
const RUN_RIGHT_2: string[][] = [
  //0 1 2 3 4 5 6 7 8 9 A B C D E F
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T], // 0
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T], // 1
  [T,T,T,T,T,T,T,T,T,T,T,T,B,B,T,T], // 2  ear
  [T,T,T,T,T,T,T,B,B,B,W,W,B,B,T,T], // 3  head
  [T,T,B,T,T,T,B,W,W,W,W,B,W,B,T,T], // 4  tail tip + head
  [T,B,W,B,T,B,W,W,W,W,W,P,W,B,T,T], // 5  tail + nose
  [T,T,B,B,B,W,W,W,W,W,W,W,B,T,T,T], // 6  tail→body
  [T,T,T,B,W,W,G,W,G,W,G,W,B,T,T,T], // 7  checker
  [T,T,T,B,W,G,W,G,W,G,W,G,B,T,T,T], // 8  checker
  [T,T,T,T,B,W,G,W,G,W,G,W,B,T,T,T], // 9  checker
  [T,T,T,T,B,B,B,B,B,B,B,B,T,T,T,T], // 10 feet
  [T,T,T,T,T,T,B,B,B,B,T,T,T,T,T,T], // 11 legs tucked
  [T,T,T,T,T,T,B,T,T,B,T,T,T,T,T,T], // 12 paws
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T], // 13
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T], // 14
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T], // 15
];

// Success frame — mirrored cat jumping with paws out
const SUCCESS_RIGHT: string[][] = [
  //0 1 2 3 4 5 6 7 8 9 A B C D E F
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T], // 0
  [T,T,B,T,T,T,T,T,T,T,T,B,B,T,T,T], // 1  tail tip + ear
  [T,B,W,B,T,T,T,B,B,B,W,W,B,B,T,T], // 2  tail + head
  [T,T,B,W,B,T,B,W,W,W,W,B,W,B,T,T], // 3  tail + eye
  [T,T,T,B,B,B,W,W,W,W,W,P,W,B,T,T], // 4  tail→body + nose
  [T,T,T,B,W,W,W,W,W,W,W,W,B,T,B,T], // 5  body + paw
  [T,T,T,B,W,W,G,W,G,W,G,W,B,B,W,B], // 6  checker + paw
  [T,T,T,B,W,G,W,G,W,G,W,G,B,T,B,T], // 7  checker
  [T,T,T,T,B,W,G,W,G,W,G,W,B,T,T,T], // 8  checker
  [T,T,T,T,T,B,B,B,B,B,B,B,T,T,T,T], // 9  bottom
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T], // 10
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T], // 11
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T], // 12
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T], // 13
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T], // 14
  [T,T,T,T,T,T,T,T,T,T,T,T,T,T,T,T], // 15
];

/* ================================================================== */
/*  Box-shadow renderer                                                */
/* ================================================================== */

function spriteToBoxShadow(sprite: string[][]): string {
  const shadows: string[] = [];
  for (let y = 0; y < sprite.length; y++) {
    for (let x = 0; x < sprite[y].length; x++) {
      const color = sprite[y][x];
      if (color) {
        shadows.push(`${x * S}px ${y * S}px 0 ${color}`);
      }
    }
  }
  return shadows.join(',');
}

// Pre-compute all shadows
const IDLE_LEFT_1 = spriteToBoxShadow(CAT_LEFT);
const IDLE_LEFT_2 = spriteToBoxShadow(CAT_LEFT_2);
const IDLE_RIGHT_1 = spriteToBoxShadow(mirrorSprite(CAT_LEFT));
const IDLE_RIGHT_2 = spriteToBoxShadow(mirrorSprite(CAT_LEFT_2));
const RUN_R1 = spriteToBoxShadow(RUN_RIGHT_1);
const RUN_R2 = spriteToBoxShadow(RUN_RIGHT_2);
const SUCCESS_R = spriteToBoxShadow(SUCCESS_RIGHT);

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */

export function PixelCat({ state = 'idle', scale = 3 }: Props) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (state === 'idle') {
      // Tail swish every 800ms
      const id = setInterval(() => setFrame((f) => (f + 1) % 2), 800);
      return () => clearInterval(id);
    }
    if (state === 'processing') {
      // Run cycle every 150ms
      const id = setInterval(() => setFrame((f) => (f + 1) % 2), 150);
      return () => clearInterval(id);
    }
    if (state === 'success') {
      setFrame(0);
    }
  }, [state]);

  let shadow: string;
  if (state === 'idle') {
    // Facing left (reference pose)
    shadow = frame === 0 ? IDLE_LEFT_1 : IDLE_LEFT_2;
  } else if (state === 'processing') {
    // Facing right, running
    shadow = frame === 0 ? RUN_R1 : RUN_R2;
  } else {
    // Facing right, celebrating
    shadow = SUCCESS_R;
  }

  return (
    <div
      className="relative"
      style={{
        width: 16 * scale,
        height: 16 * scale,
      }}
      aria-hidden="true"
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: S,
          height: S,
          boxShadow: shadow,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          imageRendering: 'pixelated',
        }}
      />
    </div>
  );
}
