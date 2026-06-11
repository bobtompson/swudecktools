<script lang="ts">
  import type { Hyperspace } from '../lib/hyperspace';

  let { active = false }: { active?: boolean } = $props();

  let canvas: HTMLCanvasElement | undefined = $state();
  let visible = $state(false);
  let hyper: Hyperspace | null = null;
  let failed = false;

  const reduceMotion =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  async function start() {
    if (failed || reduceMotion || !canvas) return;
    visible = true;
    if (!hyper) {
      try {
        const { createHyperspace } = await import('../lib/hyperspace');
        hyper = await createHyperspace(canvas);
      } catch {
        // No WebGL (or three failed to load): silently skip the effect.
        failed = true;
        visible = false;
        return;
      }
    }
    hyper.engage();
  }

  async function stop() {
    if (!hyper) {
      visible = false;
      return;
    }
    await hyper.disengage();
    visible = false;
  }

  $effect(() => {
    if (active) start();
    else stop();
  });

  $effect(() => () => hyper?.dispose());
</script>

<div class="hyper" class:visible aria-hidden="true">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .hyper {
    position: fixed;
    inset: 0;
    z-index: 40;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.3s ease;
    /* Tunnel vignette: keep the center clear, darken the page toward the edges. */
    background: radial-gradient(ellipse at center, rgba(5, 7, 13, 0.3), rgba(5, 7, 13, 0.8));
  }
  .hyper.visible {
    opacity: 1;
  }
  canvas {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
