<template>
  <!-- Drawn on a 5-unit grid (21 x 20 cells) with a single stroke weight. Render it at a
       height that is a multiple of 20px (40px = 2px cells) and every edge lands on a whole
       pixel, including at 150% and 200% display scaling; other sizes work but look softer. -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 105 100"
    aria-hidden="true"
    focusable="false"
  >
    <g fill="none" stroke="currentColor" stroke-width="5">
      <path d="M2.5 25V2.5H25M80 2.5h22.5V25M2.5 75v22.5H25M80 97.5h22.5V75" />
      <path d="M77.5 45V18.5A6 6 0 0 0 71.5 12.5H33.5A6 6 0 0 0 27.5 18.5V81.5A6 6 0 0 0 33.5 87.5H71.5A6 6 0 0 0 77.5 81.5V80" />
      <path d="M47.5 22.5h10" stroke-linecap="round" />
    </g>
    <!-- One path, so abutting pixels share a fill and show no seams. -->
    <path
      fill="currentColor"
      d="M65 30h5v5h-5zM65 35h5v5h-5zM70 35h5v5h-5zM60 40h5v5h-5zM70 40h5v5h-5zM80 40h5v5h-5zM60 50h5v5h-5zM65 50h5v5h-5zM70 50h5v5h-5zM55 55h5v5h-5zM60 55h5v5h-5zM60 60h5v5h-5zM65 60h5v5h-5zM70 60h5v5h-5zM60 65h5v5h-5zM70 65h5v5h-5zM55 70h5v5h-5zM65 70h5v5h-5zM70 70h5v5h-5zM65 75h5v5h-5zM70 75h5v5h-5zM75 30h5v5h-5zM75 35h5v5h-5zM75 40h5v5h-5zM85 50h5v5h-5zM75 55h5v5h-5zM45 60h5v5h-5zM80 65h5v5h-5zM85 75h5v5h-5zM62.5 45h2.5v5h-2.5zM70 80h5.5v5h-5.5z"
    />
  </svg>
</template>

<script>
export default {
  name: 'LeviathanIcon',
};
</script>
