import { createRouter, createWebHistory } from 'vue-router';
import store from '@/store';  // Adjust the path as needed

const routes = [
  {
    path: '/',
    name: 'dashboard',
    component: () => import("@/pages/index.vue"),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/about',
    name: 'About',
    component: () => import("@/views/About.vue")
  },
  {
    path: '/editor',
    name: 'Editor',
    component: () => import("@/pages/editor.vue"),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: "/CodeViewer",
    name: "CodeViewer",
    component: () => import("@/components/Android/CodeViewer.vue"),
    meta: {
      requiresAuth: true
    }
  },
    {
    path: '/results/:application',
    name: 'Results',
    component: () => import('@/pages/results.vue'),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/frida/scripting',
    name: 'Frida-Scripting',
    component: () => import('@/components/Frida/Scripting.vue'),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/frida/devices',
    name: 'Frida-Devices',
    component: () => import('@/components/Frida/Devices.vue'),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/ai/mcp',
    name: 'AI-MCP',
    component: () => import('@/pages/ai/mcp.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/ai/agents',
    name: 'AI-Agents',
    component: () => import('@/pages/ai/agents.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/components/Auth/Login.vue')
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/components/Auth/Register.vue')

  },
  {
    path: '/engine',
    name: 'Engine',
    component: () => import('@/pages/engine.vue'),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/engine/settings',
    name: 'Engine-Settings',
    component: () => import('@/components/Engine/Settings.vue'),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/engine/logs',
    name: 'Engine-Logs',
    component: () => import('@/pages/scan-logs.vue'),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('@/pages/Users/Profile.vue'),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/ios/decompiler/:filename',
    name: 'iOSDecompilerFilename',
    //component: () => import('@/pages/iOS/Decompiler/[filename].vue'),
    children: [
      {
        path: ':address',
        name: 'iOSDecompilerFilenameAddress',
        component: () => import('@/pages/iOS/Decompiler/[filename]/[address].vue'),
        meta: {
          requiresAuth: true
        }
      }
    ]
  },
  {
     path: '/upload/bulk',
      name: 'BulkUpload',
      component: () => import('@/components/Engine/BulkUpload.vue'),
      meta: {
        requiresAuth: true
      }
  },
  {
    path: '/vulnerabilities/:filename',
    name: 'VulnerabilitiesFilename',
    component: () => import('@/pages/vulnerabilities/[filename].vue'),
    meta: {
      requiresAuth: true
    }
  },

  {
    path: '/:pathMatch(.*)*',
     name: 'NotFound',
     //component: () => import('@/pages/404.vue')
  },

];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});

router.beforeEach((to, from, next) => {
  if (to.matched.some(record => record.meta.requiresAuth)) {
    if (!store.getters.isAuthenticated) {
      next({
        path: '/login',
        query: { redirect: to.fullPath }
      });
    } else {
      next();
    }
  } else {
    next();
  }
});

console.log('Router Routes:', router.getRoutes());

export default router;
