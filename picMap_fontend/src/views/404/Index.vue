<template>
  <div class="notfound-container">
    <div class="glitch" data-text="404">404</div>
    <div class="desc">page not found</div>
    <router-link to="/picMap" class="back-home">back to PicMap</router-link>
    <div class="stars">
      <div v-for="n in 30" :key="n" class="star"></div>
    </div>
  </div>
</template>

<script lang="ts" setup>
</script>

<style lang="scss" scoped>
.notfound-container {
  position: relative;
  min-height: 100vh;
  background: radial-gradient(ellipse at center, #232526 0%, #1a1a1a 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.glitch {
  font-size: 8rem;
  font-weight: bold;
  color: #fff;
  position: relative;
  letter-spacing: 10px;
  animation: glitch 1s infinite linear alternate-reverse;
  text-shadow:
    2px 0 #ff00c8,
    -2px 0 #00fff9,
    0 2px #fff,
    0 -2px #fff;
  user-select: none;
}

.glitch::before,
.glitch::after {
  content: attr(data-text);
  position: absolute;
  left: 0;
  width: 100%;
  overflow: hidden;
  color: #fff;
  background: transparent;
}

.glitch::before {
  top: -2px;
  left: 2px;
  color: #ff00c8;
  z-index: 1;
  animation: glitchTop 1s infinite linear alternate-reverse;
}

.glitch::after {
  top: 2px;
  left: -2px;
  color: #00fff9;
  z-index: 2;
  animation: glitchBottom 1s infinite linear alternate-reverse;
}

@keyframes glitch {
  0% {
    text-shadow: 2px 0 #ff00c8, -2px 0 #00fff9;
  }

  20% {
    text-shadow: -2px 0 #ff00c8, 2px 0 #00fff9;
  }

  40% {
    text-shadow: 2px 2px #ff00c8, -2px -2px #00fff9;
  }

  60% {
    text-shadow: -2px -2px #ff00c8, 2px 2px #00fff9;
  }

  80% {
    text-shadow: 2px -2px #ff00c8, -2px 2px #00fff9;
  }

  100% {
    text-shadow: -2px 2px #ff00c8, 2px -2px #00fff9;
  }
}

@keyframes glitchTop {
  0% {
    clip-path: inset(0 0 80% 0);
  }

  50% {
    clip-path: inset(0 0 60% 0);
  }

  100% {
    clip-path: inset(0 0 80% 0);
  }
}

@keyframes glitchBottom {
  0% {
    clip-path: inset(80% 0 0 0);
  }

  50% {
    clip-path: inset(60% 0 0 0);
  }

  100% {
    clip-path: inset(80% 0 0 0);
  }
}

.desc {
  color: #fff;
  font-size: 1.5rem;
  margin: 30px 0 20px 0;
  letter-spacing: 2px;
  text-shadow: 0 2px 8px #000;
}

.back-home {
  display: inline-block;
  margin-top: 10px;
  padding: 10px 30px;
  background: linear-gradient(90deg, #00fff9 0%, #ff00c8 100%);
  color: #232526;
  font-weight: bold;
  border-radius: 30px;
  text-decoration: none;
  box-shadow: 0 2px 16px #0008;
  transition: background 0.3s, color 0.3s;
  font-size: 1.1rem;
}

.back-home:hover {
  background: linear-gradient(90deg, #ff00c8 0%, #00fff9 100%);
  color: #fff;
}

.stars {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 0;
}

.star {
  position: absolute;
  width: 2px;
  height: 2px;
  background: #fff;
  border-radius: 50%;
  opacity: 0.7;
  animation: twinkle 2s infinite alternate;
}

.star:nth-child(1) {
  top: 10%;
  left: 20%;
  animation-delay: 0.1s;
}

.star:nth-child(2) {
  top: 30%;
  left: 80%;
  animation-delay: 0.3s;
}

.star:nth-child(3) {
  top: 60%;
  left: 50%;
  animation-delay: 0.5s;
}

.star:nth-child(4) {
  top: 80%;
  left: 70%;
  animation-delay: 0.7s;
}

.star:nth-child(5) {
  top: 50%;
  left: 10%;
  animation-delay: 0.9s;
}

.star:nth-child(6) {
  top: 15%;
  left: 60%;
  animation-delay: 1.1s;
}

.star:nth-child(7) {
  top: 70%;
  left: 30%;
  animation-delay: 1.3s;
}

.star:nth-child(8) {
  top: 40%;
  left: 40%;
  animation-delay: 1.5s;
}

.star:nth-child(9) {
  top: 85%;
  left: 15%;
  animation-delay: 1.7s;
}

.star:nth-child(10) {
  top: 25%;
  left: 55%;
  animation-delay: 1.9s;
}

/* ...可继续添加更多星星 ... */

@keyframes twinkle {
  0% {
    opacity: 0.7;
  }

  50% {
    opacity: 0.2;
  }

  100% {
    opacity: 0.7;
  }
}
</style>