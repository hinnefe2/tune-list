import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    name: 'home',
    redirect: { name: 'tunes' },
  },
  {
    path: '/tunes',
    name: 'tunes',
    component: () => import('@/views/TunesView.vue'),
  },
  {
    path: '/tunes/:id',
    name: 'tune-detail',
    component: () => import('@/views/TuneDetailView.vue'),
    props: true,
  },
  {
    path: '/capture',
    name: 'capture',
    component: () => import('@/views/CaptureView.vue'),
  },
  {
    path: '/practice',
    name: 'practice',
    component: () => import('@/views/PracticeView.vue'),
  },
  {
    path: '/sources',
    name: 'sources',
    component: () => import('@/views/SourcesView.vue'),
  },
  {
    path: '/sources/:id',
    name: 'source-detail',
    component: () => import('@/views/SourceDetailView.vue'),
    props: true,
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('@/views/ProfileView.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: { name: 'tunes' },
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!to.meta.public && !auth.isSignedIn) {
    return { name: 'login', query: { next: to.fullPath } }
  }
  if (to.name === 'login' && auth.isSignedIn) {
    return { name: 'tunes' }
  }
})
