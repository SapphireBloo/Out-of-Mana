let config = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 600 },
      debug: false
    }
  },
  scene: {
    preload: preload,
    create: create,
    update: update
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

let game = new Phaser.Game(config);

let bird, cursors, hasLanded = false, hasBumped = false, isGameStarted = false, isWaitingForClick = false, messageToPlayer, score = 0, scoreText;
let columnHeight = 320, columnSpeed = -100, stamina = 150, maxStamina = 150, staminaBar, staminaDrainPerFlap = 4;
let blueDotGroup, particles, logo, highScoreText, highScore = localStorage.getItem('highScore') ? parseInt(localStorage.getItem('highScore')) : 0;
let isDodging = false, dodgeCooldown = false, dodgeDuration = 1000, dodgeCooldownDuration = 3000;
let loreText;
let isLoreComplete = false;
function preload() {
  this.load.image('background', 'assets/background.png');
  this.load.image('road', 'assets/road.png');
  this.load.image('column', 'assets/column.png');
  this.load.image('blueDot', 'assets/blue-dot.png');
  this.load.image('spark', 'assets/spark.png');
  this.load.spritesheet('bird', 'assets/bird.png', { frameWidth: 64, frameHeight: 96 });
  this.load.audio('bgMusic', 'assets/bg-music.mp3');
  this.load.audio('pickupSound', 'assets/pickup.wav');
  this.load.image('logo', 'assets/logo.png');
  this.load.image('enemy', 'assets/enemy.png');

}


function create() {
  columnHeight = this.textures.get('column').getSourceImage().height;

  this.background = this.add.tileSprite(0, 0, game.config.width, game.config.height, 'background').setOrigin(0, 0);
  const road = this.physics.add.staticImage(game.config.width / 2, game.config.height - 32, 'road').setScale(2).refreshBody();

  const birdScale = game.config.width / 400;
  bird = this.physics.add.sprite(100, 50, 'bird').setScale(birdScale);
  bird.setBounce(0.2);
  bird.setCollideWorldBounds(true);
  bird.setSize(bird.width * 0.6, bird.height * 0.6).setOffset(3, 3);
  bird.body.allowGravity = false;
  cursors = this.input.keyboard.createCursorKeys();

  logo = this.add.image(game.config.width / 2, game.config.height / 2, 'logo').setOrigin(0.5);
  this.tweens.add({ targets: logo, y: game.config.height / 2 - 20, ease: 'Sine.easeInOut', duration: 1000, yoyo: true, repeat: -1 });

  loreText = this.add.text(game.config.width / 2, game.config.height + 50, 'In a world where birds soar and dodge...', {
    font: '32px Arial',
    color: '#FFFFFF',
    align: 'center',
    wordWrap: { width: game.config.width - 40 }
  }).setOrigin(0.5, 0.5);

  loreText.setText('In a world of magic and wonder...\n\n...The adventure of survival begins!\n\nDirty Necromancers have taking everthing..... but your head and mana!\n\nYou must overcome obstacles and enemies, collect items, and aim for the highest score!\n\nDont run out of mana!');

  messageToPlayer = this.add.text(game.config.width / 2, game.config.height / 2 + 300, 'Press space to begin!', {
    font: '32px Arial',
    color: '#FFFFFF',
    align: 'center',
    backgroundColor: '#000000'
  }).setOrigin(0.5, 0.5).setVisible(false);

  this.tweens.add({
    targets: loreText,
    y: game.config.height / 2 - 200,  // Adjust this to where you want the lore to end
    duration: 5000,  // How long the lore scrolls (5 seconds)
    ease: 'Sine.easeInOut',
    onComplete: () => {
      // After the lore text finishes scrolling, show the "Press Space" message
      messageToPlayer.setVisible(true);
    }
  });


  messageToPlayer = this.add.text(game.config.width / 2, game.config.height / 2 + 300, 'Press space to begin!', {
    font: '32px Arial',
    color: '#FFFFFF',
    align: 'center',
    backgroundColor: '#000000'
  }).setOrigin(0.5, 0.5);

  this.uiLayer = this.add.layer();
  scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '32px', fill: '#fff', fontFamily: 'Arial' });
  this.children.bringToTop(scoreText);

  this.staminaBg = this.add.rectangle(bird.x, bird.y + 40, 80, 8, 0x000000).setOrigin(0.5);
  staminaBar = this.add.rectangle(bird.x, bird.y + 40, 76, 6, 0x3399ff).setOrigin(0.5);
  this.uiLayer.add([this.staminaBg, staminaBar]);

  this.bgMusic = this.sound.add('bgMusic', { loop: true, volume: 0.5 });
  this.bgMusic.play();

  this.columnsGroup = this.physics.add.group();
  blueDotGroup = this.physics.add.group();
  this.enemyGroup = this.physics.add.group();

  particles = this.add.particles('spark');

  this.physics.add.collider(bird, road, () => {
    hasLanded = true;
    endGame(this);
  });

 

  this.physics.add.overlap(bird, blueDotGroup, (bird, dot) => {
    stamina = Math.min(maxStamina, stamina + 60);
    showPickupEffect.call(this, dot.x, dot.y);
    dot.destroy();
    this.sound.play('pickupSound', { volume: 0.6 });
  });

  scheduleNextColumn.call(this);

  this.physics.add.overlap(bird, this.columnsGroup, (bird, col) => {
    if (!isDodging && !hasBumped && !hasLanded) {
      hasBumped = true;
      endGame(this);
    }
  });
  
  this.physics.add.overlap(bird, this.enemyGroup, (bird, enemy) => {
    if (!isDodging && !hasBumped && !hasLanded) {
      hasBumped = true;
      endGame(this);
    }
  });
  

  this.input.keyboard.on('keydown-R', () => {
    if (hasLanded || hasBumped) restartGame(this);
  });

  this.input.keyboard.on('keydown-SPACE', () => {
    if (!isGameStarted) {
      isGameStarted = true;
      bird.body.allowGravity = true;
      loreText.setVisible(false);
      messageToPlayer.setVisible(false);
  
      // Fade out logo
      this.tweens.add({
        targets: logo,
        alpha: 0,
        duration: 500,
        onComplete: () => {
          logo.setVisible(false);
        }
      });
      this.input.keyboard.on('keydown-D', () => {
        if (!isDodging && !dodgeCooldown && isGameStarted && !isWaitingForClick && !hasLanded && !hasBumped) {
          activateDodge.call(this);
        }
      });
      
      
  
      this.time.delayedCall(500, () => {
        this.physics.pause();
        isWaitingForClick = true;
        messageToPlayer.setText('Click to Flap!/ D to dodge!');
        messageToPlayer.setPosition(game.config.width / 2, game.config.height / 2);
        messageToPlayer.setVisible(true);
        messageToPlayer.setAlpha(1);
        this.tweens.add({
          targets: messageToPlayer,
          alpha: 0.3,
          duration: 500,
          yoyo: true,
          repeat: -1
        });
      });
    }
  });

  this.input.on('pointerdown', () => {
    if (isWaitingForClick) {
      this.physics.resume();
      isWaitingForClick = false;
      messageToPlayer.setVisible(false);
      return;
    }

    if (!isGameStarted || hasLanded || hasBumped) return;

    if (stamina >= staminaDrainPerFlap) {
      bird.setVelocityY(-200);
      this.tweens.add({ targets: bird, rotation: -Math.PI / 4, duration: 100, ease: 'Power2' });
      stamina = Math.max(0, stamina - staminaDrainPerFlap);
    }
  });

  highScoreText = this.add.text(16, 60, 'High Score: ' + highScore, { fontSize: '32px', fill: '#fff', fontFamily: 'Arial' });
  this.children.bringToTop(highScoreText);
}

function update() {
  if ((hasLanded || hasBumped) && Phaser.Input.Keyboard.JustDown(cursors.space)) {
    this.scene.restart();
    hasLanded = false;
    hasBumped = false;
    isGameStarted = false;
    score = 0;
    columnSpeed = -100;
    stamina = maxStamina;
    return;
  }

  if (!isGameStarted || isWaitingForClick || hasLanded || hasBumped) return;

  this.background.tilePositionX += 0.5;

  if (Phaser.Input.Keyboard.JustDown(cursors.up) && stamina >= staminaDrainPerFlap) {
    bird.setVelocityY(-200);
    this.tweens.add({ targets: bird, rotation: -Math.PI / 4, duration: 100, ease: 'Power2' });
    stamina = Math.max(0, stamina - staminaDrainPerFlap);
  }

  if (bird.body.velocity.y > 0 && bird.rotation < Math.PI / 2) {
    this.tweens.add({ targets: bird, rotation: Math.PI / 2, duration: 300, ease: 'Sine.easeInOut' });
  }

  if (Math.abs(bird.body.velocity.y) < 10 && !cursors.up.isDown) {
    bird.rotation = 0;
  }

  bird.x = 100;
  columnSpeed = -100 - Math.floor(score / 5);

  this.columnsGroup.getChildren().forEach(col => {
    col.setVelocityX(columnSpeed);

    if (col.x < -col.width) {
      this.columnsGroup.remove(col, true, true);
    }

    if (col.isScoringColumn && !col.scored && col.x + col.width < bird.x) {
      col.scored = true;
      score += 1;
      scoreText.setText('Score: ' + score);
      this.tweens.add({ targets: scoreText, scale: { from: 1.3, to: 1 }, duration: 200, ease: 'Back.Out' });
    }
  });

  blueDotGroup.getChildren().forEach(dot => {
    if (dot.x < -dot.width) dot.destroy();
  });

  this.enemyGroup.getChildren().forEach(enemy => {
    // Destroy if off screen
    if (
      enemy.x < -enemy.width || enemy.x > game.config.width + enemy.width ||
      enemy.y < -enemy.height || enemy.y > game.config.height + enemy.height
    ) {
      enemy.destroy();
      return;
    }
  
    // Enemy "sees" player and charges
    const chargeDistance =300; 
    if (!enemy.charging && bird.x > enemy.x - chargeDistance && bird.x < enemy.x) {
      const dx = bird.x - enemy.x;
      const dy = bird.y - enemy.y;
      const angle = Math.atan2(dy, dx);
      const speed = 200 + score * 3;
  
      enemy.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
      enemy.charging = true;
    }
  });
  
  
  

  const offsetY = bird.displayHeight * 0.6;
  this.staminaBg.setPosition(bird.x, bird.y + offsetY + 20);
  staminaBar.setPosition(bird.x, bird.y + offsetY + 20);

  const staminaRatio = stamina / maxStamina;
  staminaBar.width = Math.max(0, Math.min(76, staminaRatio * 76));
  staminaBar.fillColor = staminaRatio < 0.25 ? 0xff5555 : 0x3399ff;
  staminaBar.alpha = staminaRatio < 0.25 ? 0.8 + 0.2 * Math.sin(this.time.now / 100) : 1;
}

function spawnColumns() {
  if (!isGameStarted || hasLanded || hasBumped) return;

  columnSpeed = -100 - Math.floor(score / 5);
  let baseGap = 180 - score * 2;
  baseGap = Phaser.Math.Clamp(baseGap, 100, 180);
  const minGap = bird.displayHeight;
  const gap = Math.max(baseGap, minGap);

  const verticalMargin = 40;
  const minGapY = columnHeight + gap / 2 + verticalMargin;
  const maxGapY = game.config.height - columnHeight - gap / 2 - verticalMargin;
  
  const gapCenterY = Phaser.Math.Between(minGapY, maxGapY);

  const topY = gapCenterY - gap / 2 - columnHeight;
  const bottomY = gapCenterY + gap / 2;
  const spawnX = game.config.width + 64;

  const top = this.columnsGroup.create(spawnX, topY, 'column').setOrigin(0, 0);
  const bottom = this.columnsGroup.create(spawnX, bottomY, 'column').setOrigin(0, 0);
  top.isScoringColumn = true;

  [top, bottom].forEach(col => {
    col.body.immovable = true;
    col.body.allowGravity = false;
    col.setVelocityX(columnSpeed);
    col.scored = false;
  });

  if (score > 10) {
    [top, bottom].forEach(col => {
      if (Phaser.Math.Between(0, 1) < 0.5) {
        const yoyoDistance = Phaser.Math.Between(20, 20 + Math.floor(score / 5));
        this.tweens.add({
          targets: col,
          y: { from: col.y, to: col.y + Phaser.Math.Between(-yoyoDistance, yoyoDistance) },
          duration: Phaser.Math.Between(800, 1200),
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    });
  }

  if (Phaser.Math.Between(0, 1) < 0.65) {
    const dot = blueDotGroup.create(spawnX + 40, gapCenterY + Phaser.Math.Between(-40, 40), 'blueDot').setScale(0.1).setTint(0x00ccff);
    dot.body.allowGravity = false;
    dot.setVelocityX(columnSpeed);

    this.tweens.add({
      targets: dot,
      y: { from: topY + columnHeight + 10, to: bottomY - 10 },
      duration: 2000 + Phaser.Math.Between(0, 1000),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  if (score >= 35 && Phaser.Math.Between(0, 1) < 0.5) {
    const enemyY = gapCenterY + Phaser.Math.Between(-20, 20);
    const enemy = this.enemyGroup.create(spawnX + 40, enemyY, 'enemy').setScale(0.5);
    enemy.body.allowGravity = false;
    enemy.setVelocityX(columnSpeed); // Moves with the column
  
    enemy.setCircle(enemy.width * 0.20);
    enemy.setOffset(enemy.width * 0.5 - enemy.width * 0.25, enemy.height * 0.5 - enemy.width * 0.25);
  
    enemy.charging = false; // Will only charge once bird is in range
  }
  
  
  
  
  
}

function scheduleNextColumn() {
  const delay = Phaser.Math.Between(2000, 3500);
  this.time.delayedCall(delay, () => {
    spawnColumns.call(this);
    scheduleNextColumn.call(this);
  });
}

function showPickupEffect(x, y) {
  const emitter = particles.createEmitter({
    x: x,
    y: y,
    speed: { min: -100, max: 100 },
    scale: { start: 0.1, end: 0 },
    alpha: { start: 1, end: 0 },
    lifespan: 400,
    quantity: 5,
    blendMode: 'ADD'
  });
  this.time.delayedCall(300, () => emitter.stop());
}

function endGame(scene) {
  bird.setVelocity(0, 0);
  bird.body.allowGravity = false;
  bird.anims.pause?.();
  scene.physics.pause();
  scene.bgMusic?.stop();

  if (score > highScore) {
    highScore = score;
    localStorage.setItem('highScore', highScore);
  }

  messageToPlayer.setText('Press Spacebar/R to Restart!');
  messageToPlayer.setPosition(game.config.width / 2, game.config.height / 2);
  messageToPlayer.setOrigin(0.5);
  messageToPlayer.setVisible(true);
  messageToPlayer.setAlpha(1);
  scene.children.bringToTop(messageToPlayer);
}

function activateDodge() {
  isDodging = true;
  dodgeCooldown = true;

  // Optional visual effect: blink while dodging
  this.tweens.add({
    targets: bird,
    alpha: { from: 1, to: 0.2 },
    duration: 100,
    yoyo: true,
    repeat: -1
  });

  // End dodge after duration
  this.time.delayedCall(dodgeDuration, () => {
    isDodging = false;
    bird.alpha = 1;
    this.tweens.killTweensOf(bird);
  });

  // End cooldown after cooldown duration
  this.time.delayedCall(dodgeCooldownDuration, () => {
    dodgeCooldown = false;
  });
}


function restartGame(scene) {
  scene.scene.restart();
  hasLanded = false;
  hasBumped = false;
 
}
