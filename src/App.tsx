import React, { useState, useEffect, useCallback, useRef } from 'react';

interface Position { x: number; y: number; }
interface Bullet extends Position { id: number; angle: number; speed: number; weaponType: string; }
interface Enemy extends Position { id: number; health: number; type: string; angle: number; }
interface Particle extends Position { id: number; vx: number; vy: number; life: number; color: string; size: number; }
interface Bolt extends Position { id: number; value: number; }
interface Explosion extends Position { id: number; frame: number; }

const WEAPONS = [
  { name: 'Combustor', color: '#ff6600', damage: 10, fireRate: 150, speed: 18, icon: '🔥' },
  { name: 'Plasma Coil', color: '#00ffff', damage: 15, fireRate: 300, speed: 14, icon: '⚡' },
  { name: 'Buzz Blades', color: '#ff00ff', damage: 8, fireRate: 100, speed: 12, icon: '💿' },
  { name: 'RYNO', color: '#ff0040', damage: 50, fireRate: 500, speed: 20, icon: '🚀' },
];

const ENEMY_TYPES = [
  { type: 'drone', health: 20, color: '#ff4444', speed: 1.5, size: 24, points: 100 },
  { type: 'tank', health: 60, color: '#44ff44', speed: 0.8, size: 36, points: 250 },
  { type: 'swarm', health: 10, color: '#ffff44', speed: 2.5, size: 16, points: 50 },
];

export default function App() {
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameover'>('menu');
  const [player, setPlayer] = useState<Position>({ x: 400, y: 300 });
  const [playerAngle, setPlayerAngle] = useState(0);
  const [health, setHealth] = useState(100);
  const [bolts, setBolts] = useState(0);
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(1);
  const [currentWeapon, setCurrentWeapon] = useState(0);
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [boltPickups, setBoltPickups] = useState<Bolt[]>([]);
  const [explosions, setExplosions] = useState<Explosion[]>([]);
  const [screenShake, setScreenShake] = useState({ x: 0, y: 0 });
  const [enemiesKilled, setEnemiesKilled] = useState(0);
  
  const keys = useRef<Set<string>>(new Set());
  const mousePos = useRef<Position>({ x: 400, y: 300 });
  const lastShot = useRef(0);
  const isShooting = useRef(false);
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const idCounter = useRef(0);

  const getId = () => ++idCounter.current;

  const spawnEnemy = useCallback(() => {
    const side = Math.floor(Math.random() * 4);
    const typeIndex = Math.min(Math.floor(Math.random() * Math.min(wave, 3)), 2);
    const enemyType = ENEMY_TYPES[typeIndex];
    let x = 0, y = 0;
    
    switch(side) {
      case 0: x = Math.random() * 800; y = -30; break;
      case 1: x = 830; y = Math.random() * 600; break;
      case 2: x = Math.random() * 800; y = 630; break;
      case 3: x = -30; y = Math.random() * 600; break;
    }
    
    return {
      id: getId(),
      x, y,
      health: enemyType.health + wave * 5,
      type: enemyType.type,
      angle: 0
    };
  }, [wave]);

  const createParticles = useCallback((x: number, y: number, color: string, count: number) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      newParticles.push({
        id: getId(),
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 30 + Math.random() * 30,
        color,
        size: 2 + Math.random() * 4
      });
    }
    return newParticles;
  }, []);

  const triggerScreenShake = useCallback((intensity: number) => {
    setScreenShake({
      x: (Math.random() - 0.5) * intensity,
      y: (Math.random() - 0.5) * intensity
    });
    setTimeout(() => setScreenShake({ x: 0, y: 0 }), 100);
  }, []);

  const startGame = () => {
    setGameState('playing');
    setPlayer({ x: 400, y: 300 });
    setHealth(100);
    setBolts(0);
    setScore(0);
    setWave(1);
    setCurrentWeapon(0);
    setBullets([]);
    setEnemies([]);
    setParticles([]);
    setBoltPickups([]);
    setExplosions([]);
    setEnemiesKilled(0);
  };

  useEffect(() => {
    if (gameState !== 'playing') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current.add(e.key.toLowerCase());
      if (e.key >= '1' && e.key <= '4') {
        setCurrentWeapon(parseInt(e.key) - 1);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const handleMouseMove = (e: MouseEvent) => {
      if (gameAreaRef.current) {
        const rect = gameAreaRef.current.getBoundingClientRect();
        mousePos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      }
    };
    const handleMouseDown = () => isShooting.current = true;
    const handleMouseUp = () => isShooting.current = false;

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [gameState]);

  useEffect(() => {
    if (gameState !== 'playing') return;

    const gameLoop = setInterval(() => {
      const speed = 5;
      let dx = 0, dy = 0;
      if (keys.current.has('w') || keys.current.has('arrowup')) dy -= speed;
      if (keys.current.has('s') || keys.current.has('arrowdown')) dy += speed;
      if (keys.current.has('a') || keys.current.has('arrowleft')) dx -= speed;
      if (keys.current.has('d') || keys.current.has('arrowright')) dx += speed;

      setPlayer(p => ({
        x: Math.max(20, Math.min(780, p.x + dx)),
        y: Math.max(20, Math.min(580, p.y + dy))
      }));

      setPlayer(p => {
        const angle = Math.atan2(mousePos.current.y - p.y, mousePos.current.x - p.x);
        setPlayerAngle(angle);
        return p;
      });

      const weapon = WEAPONS[currentWeapon];
      const now = Date.now();
      if (isShooting.current && now - lastShot.current > weapon.fireRate) {
        lastShot.current = now;
        setPlayer(p => {
          const angle = Math.atan2(mousePos.current.y - p.y, mousePos.current.x - p.x);
          setBullets(prev => [...prev, {
            id: getId(),
            x: p.x + Math.cos(angle) * 25,
            y: p.y + Math.sin(angle) * 25,
            angle,
            speed: weapon.speed,
            weaponType: weapon.name
          }]);
          setParticles(prev => [...prev, ...createParticles(
            p.x + Math.cos(angle) * 25,
            p.y + Math.sin(angle) * 25,
            weapon.color, 3
          )]);
          return p;
        });
      }

      setBullets(prev => prev.map(b => ({
        ...b,
        x: b.x + Math.cos(b.angle) * b.speed,
        y: b.y + Math.sin(b.angle) * b.speed
      })).filter(b => b.x >= -20 && b.x <= 820 && b.y >= -20 && b.y <= 620));

      setEnemies(prev => {
        return prev.map(e => {
          let targetX = 0, targetY = 0;
          setPlayer(p => { targetX = p.x; targetY = p.y; return p; });
          const angle = Math.atan2(targetY - e.y, targetX - e.x);
          const enemyType = ENEMY_TYPES.find(t => t.type === e.type) || ENEMY_TYPES[0];
          return {
            ...e,
            x: e.x + Math.cos(angle) * enemyType.speed,
            y: e.y + Math.sin(angle) * enemyType.speed,
            angle
          };
        });
      });

      setBullets(prevBullets => {
        let newBullets = [...prevBullets];
        setEnemies(prevEnemies => {
          let newEnemies = [...prevEnemies];
          const bulletsToRemove = new Set<number>();
          const enemiesToRemove = new Set<number>();
          const weaponUsed = WEAPONS[currentWeapon];

          newBullets.forEach(bullet => {
            newEnemies.forEach(enemy => {
              const dist = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);
              const enemyType = ENEMY_TYPES.find(t => t.type === enemy.type) || ENEMY_TYPES[0];
              if (dist < enemyType.size) {
                bulletsToRemove.add(bullet.id);
                enemy.health -= weaponUsed.damage;
                setParticles(p => [...p, ...createParticles(bullet.x, bullet.y, weaponUsed.color, 5)]);
                if (enemy.health <= 0) {
                  enemiesToRemove.add(enemy.id);
                  setScore(s => s + enemyType.points);
                  setEnemiesKilled(k => k + 1);
                  setParticles(p => [...p, ...createParticles(enemy.x, enemy.y, enemyType.color, 15)]);
                  setExplosions(exp => [...exp, { id: getId(), x: enemy.x, y: enemy.y, frame: 0 }]);
                  triggerScreenShake(8);
                  if (Math.random() > 0.3) {
                    setBoltPickups(bp => [...bp, {
                      id: getId(),
                      x: enemy.x + (Math.random() - 0.5) * 20,
                      y: enemy.y + (Math.random() - 0.5) * 20,
                      value: enemyType.points / 10
                    }]);
                  }
                }
              }
            });
          });

          return newEnemies.filter(e => !enemiesToRemove.has(e.id));
        });
        return newBullets;
      });

      setPlayer(p => {
        setEnemies(prevEnemies => {
          prevEnemies.forEach(enemy => {
            const dist = Math.hypot(p.x - enemy.x, p.y - enemy.y);
            const enemyType = ENEMY_TYPES.find(t => t.type === enemy.type) || ENEMY_TYPES[0];
            if (dist < enemyType.size + 15) {
              setHealth(h => {
                const newHealth = h - 10;
                if (newHealth <= 0) setGameState('gameover');
                return Math.max(0, newHealth);
              });
              triggerScreenShake(15);
            }
          });
          return prevEnemies;
        });
        return p;
      });

      setPlayer(p => {
        setBoltPickups(prev => {
          const remaining: Bolt[] = [];
          prev.forEach(bolt => {
            const dist = Math.hypot(p.x - bolt.x, p.y - bolt.y);
            if (dist < 30) {
              setBolts(b => b + bolt.value);
            } else {
              remaining.push(bolt);
            }
          });
          return remaining;
        });
        return p;
      });

      setParticles(prev => prev.map(p => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        vx: p.vx * 0.95,
        vy: p.vy * 0.95,
        life: p.life - 1,
        size: p.size * 0.97
      })).filter(p => p.life > 0));

      setExplosions(prev => prev.map(e => ({ ...e, frame: e.frame + 1 })).filter(e => e.frame < 10));

    }, 16);

    return () => clearInterval(gameLoop);
  }, [gameState, currentWeapon, createParticles, triggerScreenShake]);

  useEffect(() => {
    if (gameState !== 'playing') return;
    
    const spawnInterval = setInterval(() => {
      const enemiesToSpawn = Math.min(wave + 1, 5);
      setEnemies(prev => {
        if (prev.length < 15) {
          const newEnemies = [];
          for (let i = 0; i < enemiesToSpawn; i++) {
            newEnemies.push(spawnEnemy());
          }
          return [...prev, ...newEnemies];
        }
        return prev;
      });
    }, 2000 / Math.min(wave, 3));

    return () => clearInterval(spawnInterval);
  }, [gameState, wave, spawnEnemy]);

  useEffect(() => {
    if (enemiesKilled > 0 && enemiesKilled % 10 === 0) {
      setWave(w => w + 1);
    }
  }, [enemiesKilled]);

  const weapon = WEAPONS[currentWeapon];

  if (gameState === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0a1a] via-[#1a0a2a] to-[#0a0a1a] flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-cyan-400 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `pulse-glow ${2 + Math.random() * 3}s infinite`,
                animationDelay: `${Math.random() * 2}s`
              }}
            />
          ))}
        </div>
        
        <div className="relative z-10 text-center">
          <h1 className="game-font text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 mb-4 chromatic">
            GALACTIC
          </h1>
          <h2 className="game-font text-4xl md:text-6xl font-bold text-orange-500 neon-text mb-8" style={{ color: '#ff6600' }}>
            WRENCH
          </h2>
          <div className="text-cyan-300 text-lg mb-8 opacity-80">
            🔧 A Sci-Fi Action Shooter 🔧
          </div>
          
          <button
            onClick={startGame}
            className="game-font px-12 py-4 bg-gradient-to-r from-orange-600 to-red-600 text-white text-2xl font-bold rounded-lg 
                       hover:from-orange-500 hover:to-red-500 transform hover:scale-105 transition-all duration-200
                       shadow-[0_0_30px_rgba(255,102,0,0.5)] hover:shadow-[0_0_50px_rgba(255,102,0,0.8)]"
          >
            START MISSION
          </button>
          
          <div className="mt-12 text-cyan-200 opacity-70 text-sm space-y-2">
            <p>🎮 WASD or Arrow Keys to Move</p>
            <p>🖱️ Mouse to Aim & Shoot</p>
            <p>🔢 1-4 to Switch Weapons</p>
          </div>
        </div>
        
        <footer className="absolute bottom-4 text-gray-500 text-xs opacity-50">
          Requested by @JustJayJusy · Built by @clonkbot
        </footer>
      </div>
    );
  }

  if (gameState === 'gameover') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#1a0505] via-[#2a0a0a] to-[#0a0505] flex flex-col items-center justify-center relative">
        <div className="text-center">
          <h1 className="game-font text-6xl font-black text-red-500 neon-text mb-4">MISSION FAILED</h1>
          <div className="text-2xl text-gray-300 mb-2">Final Score: <span className="text-cyan-400 game-font">{score.toLocaleString()}</span></div>
          <div className="text-xl text-gray-400 mb-2">Bolts Collected: <span className="text-yellow-400 game-font">{bolts.toLocaleString()}</span></div>
          <div className="text-lg text-gray-500 mb-8">Wave Reached: <span className="text-purple-400 game-font">{wave}</span></div>
          
          <button
            onClick={startGame}
            className="game-font px-10 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-xl font-bold rounded-lg
                       hover:from-cyan-500 hover:to-blue-500 transform hover:scale-105 transition-all
                       shadow-[0_0_20px_rgba(0,255,255,0.4)]"
          >
            TRY AGAIN
          </button>
        </div>
        
        <footer className="absolute bottom-4 text-gray-600 text-xs opacity-50">
          Requested by @JustJayJusy · Built by @clonkbot
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center p-4">
      <div 
        ref={gameAreaRef}
        className="relative w-[800px] h-[600px] rounded-lg overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #0f0f1a 0%, #1a1a2e 50%, #0f0f1a 100%)',
          boxShadow: '0 0 50px rgba(0, 255, 255, 0.2), inset 0 0 100px rgba(0, 0, 0, 0.5)',
          transform: `translate(${screenShake.x}px, ${screenShake.y}px)`,
          cursor: 'crosshair'
        }}
      >
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `
            radial-gradient(circle at 20% 30%, rgba(0, 255, 255, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(255, 0, 255, 0.1) 0%, transparent 50%)
          `
        }} />
        
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h40v40H0z\' fill=\'none\' stroke=\'%2300ffff\' stroke-width=\'0.5\'/%3E%3C/svg%3E")'
        }} />

        <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-20">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-red-500 text-xl">❤️</span>
              <div className="w-32 h-4 bg-gray-800 rounded-full overflow-hidden border border-red-500/30">
                <div 
                  className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-200"
                  style={{ width: `${health}%` }}
                />
              </div>
              <span className="text-red-400 game-font text-sm">{health}</span>
            </div>
            <div className="text-yellow-400 game-font text-lg flex items-center gap-2">
              <span className="animate-pulse">⚙️</span> {bolts.toLocaleString()}
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-cyan-400 game-font text-2xl">{score.toLocaleString()}</div>
            <div className="text-purple-400 game-font text-sm">WAVE {wave}</div>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 flex gap-2 z-20">
          {WEAPONS.map((w, i) => (
            <div
              key={w.name}
              onClick={() => setCurrentWeapon(i)}
              className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl cursor-pointer transition-all
                ${i === currentWeapon 
                  ? 'bg-gradient-to-br from-gray-700 to-gray-900 border-2 scale-110' 
                  : 'bg-gray-800/50 border border-gray-600/50 opacity-60 hover:opacity-100'}`}
              style={{ borderColor: i === currentWeapon ? w.color : undefined }}
            >
              {w.icon}
              <span className="absolute -top-1 -left-1 text-xs text-gray-400 game-font">{i + 1}</span>
            </div>
          ))}
        </div>
        
        <div className="absolute bottom-4 right-4 text-right z-20">
          <div className="game-font text-sm" style={{ color: weapon.color }}>{weapon.name}</div>
        </div>

        {boltPickups.map(bolt => (
          <div
            key={bolt.id}
            className="absolute w-5 h-5 flex items-center justify-center text-yellow-400 text-lg"
            style={{
              left: bolt.x - 10,
              top: bolt.y - 10,
              animation: 'float 1s ease-in-out infinite',
              filter: 'drop-shadow(0 0 5px gold)'
            }}
          >
            ⚙️
          </div>
        ))}

        {enemies.map(enemy => {
          const enemyType = ENEMY_TYPES.find(t => t.type === enemy.type) || ENEMY_TYPES[0];
          return (
            <div
              key={enemy.id}
              className="absolute rounded-full flex items-center justify-center"
              style={{
                left: enemy.x - enemyType.size / 2,
                top: enemy.y - enemyType.size / 2,
                width: enemyType.size,
                height: enemyType.size,
                background: `radial-gradient(circle at 30% 30%, ${enemyType.color}, #000)`,
                boxShadow: `0 0 15px ${enemyType.color}60`,
                transform: `rotate(${enemy.angle + Math.PI / 2}rad)`
              }}
            >
              <div 
                className="absolute -top-1 w-0 h-0"
                style={{
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderBottom: `10px solid ${enemyType.color}`
                }}
              />
            </div>
          );
        })}

        {bullets.map(bullet => {
          const bulletWeapon = WEAPONS.find(w => w.name === bullet.weaponType) || WEAPONS[0];
          return (
            <div
              key={bullet.id}
              className="absolute rounded-full"
              style={{
                left: bullet.x - 4,
                top: bullet.y - 4,
                width: 8,
                height: 8,
                background: bulletWeapon.color,
                boxShadow: `0 0 10px ${bulletWeapon.color}, 0 0 20px ${bulletWeapon.color}`,
                transform: `rotate(${bullet.angle}rad)`
              }}
            />
          );
        })}

        <div
          className="absolute w-10 h-10 rounded-full"
          style={{
            left: player.x - 20,
            top: player.y - 20,
            background: 'radial-gradient(circle at 30% 30%, #ffa500, #ff6600, #cc4400)',
            boxShadow: '0 0 20px rgba(255, 102, 0, 0.6)',
            transform: `rotate(${playerAngle + Math.PI / 2}rad)`
          }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-3 h-4 bg-gradient-to-t from-gray-600 to-gray-400 rounded-sm" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-gradient-to-br from-gray-300 to-gray-500 rounded-full border border-gray-600" />
        </div>

        {particles.map(p => (
          <div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: p.x - p.size / 2,
              top: p.y - p.size / 2,
              width: p.size,
              height: p.size,
              background: p.color,
              opacity: p.life / 60,
              boxShadow: `0 0 ${p.size * 2}px ${p.color}`
            }}
          />
        ))}

        {explosions.map(exp => (
          <div
            key={exp.id}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: exp.x - 20 - exp.frame * 4,
              top: exp.y - 20 - exp.frame * 4,
              width: 40 + exp.frame * 8,
              height: 40 + exp.frame * 8,
              background: `radial-gradient(circle, rgba(255,200,0,${1 - exp.frame / 10}) 0%, rgba(255,100,0,${0.5 - exp.frame / 20}) 50%, transparent 70%)`,
              boxShadow: `0 0 ${30 + exp.frame * 5}px rgba(255, 150, 0, ${0.8 - exp.frame / 12})`
            }}
          />
        ))}
      </div>
      
      <footer className="mt-4 text-gray-600 text-xs opacity-40">
        Requested by @JustJayJusy · Built by @clonkbot
      </footer>
    </div>
  );
}