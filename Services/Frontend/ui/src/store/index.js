import { createStore } from 'vuex';
import axios from 'axios';
import fridaModule from "@/store/modules/fridaModule";
import { resolveJavaDefinition } from '@/utils/javaDefinitionResolver';
import { authApi } from '@/services';
import { clearAuthSession, getAuthSessionVersion } from '@/utils/http';

// Seed axios's default Authorization header from any persisted token. The
// per-request interceptor in src/utils/http.js is the source of truth, but
// having the default present means anything that captures it directly (or
// debugging in DevTools) sees the right value immediately after a hard reload.
const _persistedAccessToken = (() => {
  try { return localStorage.getItem('access_token') || ''; } catch { return ''; }
})();
if (_persistedAccessToken) {
  axios.defaults.headers.common.Authorization = `Bearer ${_persistedAccessToken}`;
}

export default createStore({
  state: {
    user: null,
    accessToken: localStorage.getItem('access_token') || '',
    refreshToken: localStorage.getItem('refresh_token') || '',
    status: '',
    isDark: localStorage.getItem('isDark') === 'true' || false,
    // Preferred decompiler engine, frontend-persisted. Passed explicitly on every
    // decompile call. Default 'jadx'; 'vineflower' is opt-in.
    decompilerEngine: localStorage.getItem('decompilerEngine') || 'jadx',
    // Whether Vineflower should also extract decoded resources (jadx --no-src).
    // Only meaningful for Vineflower; JADX always includes resources. Default false.
    decompilerResources: localStorage.getItem('decompilerResources') === 'true',
    javaCode: '',
    decompiledActivities: {},
    decompiledServices: {},
    decompiledReceivers: {},
    decompiledProviders: {},
    currentApplication: null,
    applicationResults: {},
    currentCode: '',
    currentFilename: '',
    currentComponentName: '',
    codeViewerData: {
      code: '',
      filename: '',
      componentName: ''
    },
    // CodeViewer navigation history (back/forward)
    codeViewerHistory: {
      back: [], // stack of previous { code, filename, componentName }
      forward: [] // stack of next { code, filename, componentName }
    },
    // New scan tracking state
    activeScans: {}, // { taskId: { filename, startTime, status, result?, error?, progress? } }
    scanResults: {}   // Cache recent scan results for quick access
  },
  modules: {
    frida: fridaModule
  },
  mutations: {
    SET_CODE_VIEWER_DATA(state, { code, filename, componentName }) {
      state.codeViewerData = { code, filename, componentName };
    },

    SET_CURRENT_CODE(state, code) {
      state.currentCode = code;
    },
    SET_CURRENT_FILENAME(state, filename) {
      state.currentFilename = filename;
    },
    SET_CURRENT_COMPONENT_NAME(state, name) {
      state.currentComponentName = name;
    },

    SET_CURRENT_APPLICATION(state, application) {
      state.currentApplication = application;
    },

    setDecompiledProvider(state, { filename, providerName, exists }) {
      if (!state.decompiledProviders[filename]) {
        state.decompiledProviders[filename] = {};
      }
      state.decompiledProviders[filename][providerName] = exists;
    },
    setDecompiledActivity(state, { filename, activityName, exists }) {
      if (!state.decompiledActivities[filename]) {
        state.decompiledActivities[filename] = {};
      }
      state.decompiledActivities[filename][activityName] = exists;
    },
    setUser(state, user) {
      state.user = user;
    },
    setJavaCode(state, code) {
      state.javaCode = code;
    },
    setAccessToken(state, token) {
      state.accessToken = token;
      localStorage.setItem('access_token', token);
    },
    setRefreshToken(state, token) {
      state.refreshToken = token;
      localStorage.setItem('refresh_token', token);
    },
    clearAuthData(state) {
      state.user = null;
      state.accessToken = '';
      state.refreshToken = '';
      clearAuthSession();
    },
    setDecompiledService(state, { filename, serviceName, exists }) {
      if (!state.decompiledServices[filename]) {
        state.decompiledServices[filename] = {};
      }
      state.decompiledServices[filename][serviceName] = exists;
    },
    auth_request(state) {
      state.status = 'loading';
    },
    auth_success(state, user) {
      state.status = 'success';
      state.user = user;
    },
    auth_error(state) {
      state.status = 'error';
    },
    setDarkTheme(state, isDark) {
      state.isDark = isDark;
      localStorage.setItem('isDark', isDark);
    },
    SET_DECOMPILER_ENGINE(state, engine) {
      state.decompilerEngine = engine;
      localStorage.setItem('decompilerEngine', engine);
    },
    SET_DECOMPILER_RESOURCES(state, val) {
      state.decompilerResources = val;
      localStorage.setItem('decompilerResources', String(val));
    },
    setDecompiledReceiver(state, { filename, receiverName, exists }) {
      if (!state.decompiledReceivers[filename]) {
        state.decompiledReceivers[filename] = {};
      }
      state.decompiledReceivers[filename][receiverName] = exists;
    },

    // New scan tracking mutations
    START_SCAN(state, { taskId, filename }) {
      state.activeScans[taskId] = {
        filename,
        startTime: Date.now(),
        status: 'in_progress',
        progress: 0
      };
      // Persist to localStorage for page refresh persistence
      localStorage.setItem('appshark_active_scans', JSON.stringify(state.activeScans));
    },

    COMPLETE_SCAN(state, { taskId, result }) {
      if (state.activeScans[taskId]) {
        state.activeScans[taskId].status = 'completed';
        state.activeScans[taskId].result = result;
        state.activeScans[taskId].completedTime = Date.now();
        state.activeScans[taskId].progress = 100;

        // Cache the result for quick access
        state.scanResults[state.activeScans[taskId].filename] = {
          result,
          timestamp: Date.now()
        };

        localStorage.setItem('appshark_active_scans', JSON.stringify(state.activeScans));
        localStorage.setItem('appshark_scan_results', JSON.stringify(state.scanResults));

        // Auto-remove completed scans after 5 minutes
        setTimeout(() => {
          if (state.activeScans[taskId] && state.activeScans[taskId].status === 'completed') {
            delete state.activeScans[taskId];
            localStorage.setItem('appshark_active_scans', JSON.stringify(state.activeScans));
          }
        }, 5 * 60 * 1000);
      }
    },

    FAIL_SCAN(state, { taskId, error }) {
      if (state.activeScans[taskId]) {
        state.activeScans[taskId].status = 'failed';
        state.activeScans[taskId].error = error;
        state.activeScans[taskId].failedTime = Date.now();

        localStorage.setItem('appshark_active_scans', JSON.stringify(state.activeScans));
      }
    },

    UPDATE_SCAN_TASK_ID(state, { oldTaskId, newTaskId }) {
      // Update the task ID when a queued scan gets a Celery task ID
      if (state.activeScans[oldTaskId]) {
        const scanData = { ...state.activeScans[oldTaskId], taskId: newTaskId };
        delete state.activeScans[oldTaskId];
        state.activeScans[newTaskId] = scanData;
        localStorage.setItem('appshark_active_scans', JSON.stringify(state.activeScans));
      }
    },

    UPDATE_SCAN_PROGRESS(state, { taskId, progress }) {
      if (state.activeScans[taskId]) {
        state.activeScans[taskId].progress = progress;
        state.activeScans[taskId].lastUpdate = Date.now();
        localStorage.setItem('appshark_active_scans', JSON.stringify(state.activeScans));
      }
    },

    LOAD_ACTIVE_SCANS(state) {
      try {
        const stored = localStorage.getItem('appshark_active_scans');
        const storedResults = localStorage.getItem('appshark_scan_results');

        if (stored) {
          const scans = JSON.parse(stored);

          // Clean up only OLD scans (older than 2 hours)
          // Keep completed/failed scans for displaying status, just don't resume them
          const now = Date.now();
          const maxAge = 2 * 60 * 60 * 1000; // 2 hours

          Object.keys(scans).forEach(taskId => {
            const scan = scans[taskId];
            // Only remove if too old
            if (now - scan.startTime > maxAge) {
              console.log(`Cleaning up old scan ${taskId} - status: ${scan.status}, age: ${Math.round((now - scan.startTime) / 1000)}s`);
              delete scans[taskId];
            }
          });

          state.activeScans = scans;
        }

        if (storedResults) {
          const results = JSON.parse(storedResults);

          // Clean up old results (older than 24 hours)
          const now = Date.now();
          const maxResultAge = 24 * 60 * 60 * 1000; // 24 hours

          Object.keys(results).forEach(filename => {
            const result = results[filename];
            if (now - result.timestamp > maxResultAge) {
              delete results[filename];
            }
          });

          state.scanResults = results;
        }

        // Update localStorage with cleaned data
        localStorage.setItem('appshark_active_scans', JSON.stringify(state.activeScans));
        localStorage.setItem('appshark_scan_results', JSON.stringify(state.scanResults));
      } catch (error) {
        console.error('Error loading scan data from localStorage:', error);
        state.activeScans = {};
        state.scanResults = {};
      }
    },

    REMOVE_SCAN(state, taskId) {
      delete state.activeScans[taskId];
      localStorage.setItem('appshark_active_scans', JSON.stringify(state.activeScans));
    },

    STOP_SCAN(state, { taskId }) {
      const scan = state.activeScans[taskId];
      if (scan) {
        const filename = scan.filename;

        // Mark this entry stopped
        scan.status = 'stopped';
        scan.stoppedTime = Date.now();

        // Also stop any other in-progress entries for the same filename
        Object.keys(state.activeScans).forEach(id => {
          if (state.activeScans[id]?.filename === filename && state.activeScans[id]?.status === 'in_progress') {
            state.activeScans[id].status = 'stopped';
            state.activeScans[id].stoppedTime = Date.now();
          }
        });

        localStorage.setItem('appshark_active_scans', JSON.stringify(state.activeScans));
      }
    },

    STOP_SCAN_BY_FILENAME(state, { filename }) {
      let changed = false;
      Object.keys(state.activeScans).forEach(id => {
        const s = state.activeScans[id];
        if (s?.filename === filename && s?.status === 'in_progress') {
          s.status = 'stopped';
          s.stoppedTime = Date.now();
          changed = true;
        }
      });
      if (changed) {
        localStorage.setItem('appshark_active_scans', JSON.stringify(state.activeScans));
      }
    },

    CLEAR_OLD_SCAN_RESULTS(state) {
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      Object.keys(state.scanResults).forEach(filename => {
        const result = state.scanResults[filename];
        if (now - result.timestamp > maxAge) {
          delete state.scanResults[filename];
        }
      });

      localStorage.setItem('appshark_scan_results', JSON.stringify(state.scanResults));
    },

    PUSH_CODE_VIEWER_HISTORY(state, { fromEntry, toEntry }) {
      // Push current->back, clear forward
      if (fromEntry && fromEntry.code) {
        state.codeViewerHistory.back.push(fromEntry);
        // cap history to avoid memory blowup
        if (state.codeViewerHistory.back.length > 50) {
          state.codeViewerHistory.back.shift();
        }
      }
      state.codeViewerHistory.forward = [];

      // Apply the destination entry
      if (toEntry) {
        state.currentCode = toEntry.code;
        state.currentFilename = toEntry.filename;
        state.currentComponentName = toEntry.componentName;
        state.codeViewerData = { ...toEntry };
      }
    },

    NAVIGATE_CODE_VIEWER_BACK(state) {
      if (state.codeViewerHistory.back.length === 0) return;
      const current = {
        code: state.currentCode,
        filename: state.currentFilename,
        componentName: state.currentComponentName
      };
      const prev = state.codeViewerHistory.back.pop();
      if (current.code) {
        state.codeViewerHistory.forward.push(current);
        if (state.codeViewerHistory.forward.length > 50) {
          state.codeViewerHistory.forward.shift();
        }
      }

      state.currentCode = prev.code;
      state.currentFilename = prev.filename;
      state.currentComponentName = prev.componentName;
      state.codeViewerData = { code: prev.code, filename: prev.filename, componentName: prev.componentName };
    },

    NAVIGATE_CODE_VIEWER_FORWARD(state) {
      if (state.codeViewerHistory.forward.length === 0) return;
      const current = {
        code: state.currentCode,
        filename: state.currentFilename,
        componentName: state.currentComponentName
      };
      const next = state.codeViewerHistory.forward.pop();
      if (current.code) {
        state.codeViewerHistory.back.push(current);
        if (state.codeViewerHistory.back.length > 50) {
          state.codeViewerHistory.back.shift();
        }
      }

      state.currentCode = next.code;
      state.currentFilename = next.filename;
      state.currentComponentName = next.componentName;
      state.codeViewerData = { code: next.code, filename: next.filename, componentName: next.componentName };
    },
  },

  actions: {
    setCodeViewerData({ commit, state }, { code, filename, componentName, pushHistory = false }) {
      // Optionally push history when changing CodeViewer content.
      if (pushHistory) {
        const fromEntry = {
          code: state.currentCode,
          filename: state.currentFilename,
          componentName: state.currentComponentName
        };
        const toEntry = { code, filename, componentName };
        commit('PUSH_CODE_VIEWER_HISTORY', { fromEntry, toEntry });
        return;
      }
      commit('SET_CURRENT_CODE', code);
      commit('SET_CURRENT_FILENAME', filename);
      commit('SET_CURRENT_COMPONENT_NAME', componentName);
    },

    codeViewerBack({ commit }) {
      commit('NAVIGATE_CODE_VIEWER_BACK');
    },

    codeViewerForward({ commit }) {
      commit('NAVIGATE_CODE_VIEWER_FORWARD');
    },

    /**
     * Go to definition for an identifier/class.
     * Payload: { token, file, position }
     * - file: current application id/name (used in engine/decompiled route)
     * - token: string at cursor
     */
    async goToDefinition({ state, dispatch }, { token, position, preferClass }) {
      const currentApp = state.currentFilename || state.currentApplication;
      const currentComponentName = state.currentComponentName;
      const currentCode = state.currentCode;

      const resolved = resolveJavaDefinition({
        token,
        currentComponentName,
        currentCode,
        position,
        preferClass,
      });

      if (!resolved) {
        throw new Error(`No definition found for: ${token}`);
      }

      // ── In-file jump (method/field/class declaration in same file) ────────
      if (resolved.isLocal) {
        await dispatch('setCodeViewerData', {
          code: currentCode,
          filename: currentApp,
          componentName: currentComponentName,
          pushHistory: true,
        });
        return resolved;
      }

      if (!currentApp) {
        throw new Error('No current application selected');
      }

      const base = import.meta.env.VITE_APP_API_URL || '';

      // ── Try each candidate FQN in order until one succeeds ───────────────
      const allCandidates = resolved.candidates.length
        ? resolved.candidates
        : [resolved.targetComponentName];

      let lastError = null;
      for (const candidate of allCandidates) {
        try {
          const response = await axios.get(`${base}/engine/decompiled/${currentApp}/${candidate}`);
          if (!response.data || !response.data.java_code) continue;

          await dispatch('setCodeViewerData', {
            code: response.data.java_code,
            filename: currentApp,
            componentName: candidate,
            pushHistory: true,
          });

          return { ...resolved, targetComponentName: candidate };
        } catch (err) {
          lastError = err;
          // 404 → try next candidate; anything else → bail
          if (err.response && err.response.status !== 404) break;
        }
      }

      throw new Error(
        lastError?.response?.status === 404
          ? `Source not found for: ${token} (not in decompiled output)`
          : `Failed to load definition for: ${token}`
      );
    },

    async register({ commit }, authData) {
      try {
        const response = await authApi.register(authData);
        commit('setUser', response);
      } catch (error) {
        console.error('Error registering:', error);
        throw error;
      }
    },

    async setCurrentApplication({ commit }, application) {
      commit('SET_CURRENT_APPLICATION', application);
    },

    async fetchApplicationResults({ commit, state }) {
      try {
        const response = await axios.get(`${import.meta.env.VITE_APP_API_URL}/audit/results/${state.currentApplication}`);
        commit('SET_APPLICATION_RESULTS', response.data);
      } catch (error) {
        console.error('Error fetching application results:', error);
        throw error;
      }
    },

    async checkProviderDecompiled({ commit }, { filename, providerName }) {
      if (!filename || !providerName) return false;
      try {
        const response = await axios.head(`${import.meta.env.VITE_APP_API_URL}/engine/decompiled/${filename}/${providerName}`);
        const exists = response.status === 200;
        commit('setDecompiledProvider', { filename, providerName, exists });
        return exists;
      } catch (error) {
        console.error('Error checking if provider is decompiled:', error);
        commit('setDecompiledProvider', { filename, providerName, exists: false });
        return false;
      }
    },

    async checkReceiverDecompiled({ commit }, { filename, receiverName }) {
      if (!filename || !receiverName) return false;
      try {
        const response = await axios.head(`${import.meta.env.VITE_APP_API_URL}/engine/decompiled/${filename}/${receiverName}`);
        commit('setDecompiledReceiver', { filename, receiverName, exists: response.status === 200 });
        return response.status === 200;
      } catch (error) {
        commit('setDecompiledReceiver', { filename, receiverName, exists: false });
        return false;
      }
    },

    async checkServiceDecompiled({ commit }, { filename, serviceName }) {
      if (!filename || !serviceName) return false;
      try {
        const response = await axios.head(`${import.meta.env.VITE_APP_API_URL}/engine/decompiled/${filename}/${serviceName}`);
        commit('setDecompiledService', { filename, serviceName, exists: response.status === 200 });
        return response.status === 200;
      } catch (error) {
        commit('setDecompiledService', { filename, serviceName, exists: false });
        return false;
      }
    },

    async checkActivityDecompiled({ commit }, { filename, activityName }) {
      if (!filename || !activityName) return false;
      try {
        const response = await axios.head(`${import.meta.env.VITE_APP_API_URL}/engine/decompiled/${filename}/${activityName}`);
        commit('setDecompiledActivity', { filename, activityName, exists: response.status === 200 });
        return response.status === 200;
      } catch (error) {
        commit('setDecompiledActivity', { filename, activityName, exists: false });
        return false;
      }
    },

    async login({ commit }, authData) {
      commit('clearAuthData');
      const sessionVersion = getAuthSessionVersion();
      commit('auth_request');
      return new Promise((resolve, reject) => {
        authApi.login(authData)
          .then(resp => {
            if (sessionVersion !== getAuthSessionVersion()) {
              throw new Error('Login was cancelled because the session changed.');
            }
            const accessToken = resp.access_token;
            const refreshToken = resp.refresh_token;
            const user = resp.user;
            localStorage.setItem('access_token', accessToken);
            localStorage.setItem('refresh_token', refreshToken);
            axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
            commit('auth_success', user);
            commit('setAccessToken', accessToken);
            commit('setRefreshToken', refreshToken);
            resolve(resp);
          })
          .catch(err => {
            if (sessionVersion === getAuthSessionVersion()) {
              commit('auth_error');
              commit('clearAuthData');
            }
            reject(err);
          });
      });
    },

    async logout({ commit, state }) {
      const token = state.accessToken || localStorage.getItem('access_token');
      // End the local session immediately, cancelling outstanding refreshes.
      // Keep the captured token only for the server revocation request.
      commit('clearAuthData');
      if (token) await authApi.logout(token);
    },

    async refresh({ commit, state }) {
      const sessionVersion = getAuthSessionVersion();
      const originalRefreshToken = state.refreshToken;
      try {
        const response = await authApi.refresh(originalRefreshToken);
        if (sessionVersion !== getAuthSessionVersion() || state.refreshToken !== originalRefreshToken) return;
        const accessToken = response.access_token;
        const refreshToken = response.refresh_token;
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', refreshToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        commit('setAccessToken', accessToken);
        commit('setRefreshToken', refreshToken);
      } catch (error) {
        console.error('Error refreshing token:', error);
        if (sessionVersion === getAuthSessionVersion()) commit('clearAuthData');
      }
    },

    setTheme({ commit }, isDark) {
      commit('setDarkTheme', isDark);
    },

    setDecompilerEngine({ commit }, engine) {
      commit('SET_DECOMPILER_ENGINE', engine);
    },

    setDecompilerResources({ commit }, val) {
      commit('SET_DECOMPILER_RESOURCES', val);
    },

    // New scan tracking actions
    startScan({ commit }, { taskId, filename }) {
      commit('START_SCAN', { taskId, filename });
    },

    completeScan({ commit }, { taskId, result }) {
      commit('COMPLETE_SCAN', { taskId, result });
    },

    failScan({ commit }, { taskId, error }) {
      commit('FAIL_SCAN', { taskId, error });
    },

    updateScanTaskId({ commit }, { oldTaskId, newTaskId }) {
      commit('UPDATE_SCAN_TASK_ID', { oldTaskId, newTaskId });
    },

    updateScanProgress({ commit }, { taskId, progress }) {
      commit('UPDATE_SCAN_PROGRESS', { taskId, progress });
    },

    loadActiveScans({ commit }) {
      commit('LOAD_ACTIVE_SCANS');
    },

    removeScan({ commit }, taskId) {
      commit('REMOVE_SCAN', taskId);
    },

    clearOldScanResults({ commit }) {
      commit('CLEAR_OLD_SCAN_RESULTS');
    },

    async stopScan({ commit }, taskId) {
      try {
        // Call backend to stop the scan
        const response = await axios.post(`${import.meta.env.VITE_APP_API_URL}/engine/scan/stop/${taskId}`);

        if (response.data.status === 'success') {
          commit('STOP_SCAN', { taskId });
          return { success: true, message: response.data.message };
        } else {
          return { success: false, message: response.data.message };
        }
      } catch (error) {
        console.error('Error stopping scan:', error);
        return {
          success: false,
          message: error.response?.data?.message || 'Failed to stop scan'
        };
      }
    },

    stopScanByFilename({ commit }, filename) {
      commit('STOP_SCAN_BY_FILENAME', { filename });
    },

    // Enhanced scan management
    async cancelScan({ commit, state }, { taskId, filename }) {
      try {
        // Call backend to cancel scan if your API supports it
        await axios.delete(`${import.meta.env.VITE_APP_API_URL}/engine/scan/${taskId}`);
        commit('REMOVE_SCAN', taskId);
        return true;
      } catch (error) {
        console.error('Error cancelling scan:', error);
        // Still remove from local state even if backend call fails
        commit('REMOVE_SCAN', taskId);
        return false;
      }
    },

    // Clean up expired scans periodically
    async cleanupExpiredScans({ commit, state }) {
      const now = Date.now();
      const maxAge = 2 * 60 * 60 * 1000; // 2 hours

      Object.keys(state.activeScans).forEach(taskId => {
        const scan = state.activeScans[taskId];
        if (now - scan.startTime > maxAge) {
          commit('REMOVE_SCAN', taskId);
        }
      });
    }
  },

  getters: {
    isAuthenticated: state => !!state.accessToken,
    getUser: state => state.user,
    authStatus: state => state.status,
    isDark: state => state.isDark,
    decompilerEngine: state => state.decompilerEngine,
    decompilerResources: state => state.decompilerResources,
    javaCode: state => state.javaCode,
    getCurrentApplication: state => state.currentApplication,
    getApplicationResults: state => state.applicationResults,
    getCurrentCode: state => state.currentCode,
    getCurrentFilename: state => state.currentFilename,
    getCurrentComponentName: state => state.currentComponentName,

    // New scan tracking getters
    isScanning: (state) => (filename) => {
      return Object.values(state.activeScans).some(scan =>
        scan.filename === filename && scan.status === 'in_progress'
      );
    },

    isScanFailed: (state) => (filename) => {
      return Object.values(state.activeScans).some(scan =>
        scan.filename === filename && scan.status === 'failed'
      );
    },

    getFailedScanError: (state) => (filename) => {
      const scan = Object.values(state.activeScans).find(scan =>
        scan.filename === filename && scan.status === 'failed'
      );
      return scan ? scan.error : null;
    },

    getScanTaskId: (state) => (filename) => {
      // Find the most recent task ID for this filename, regardless of status
      const entries = Object.entries(state.activeScans)
        .filter(([taskId, scan]) => scan.filename === filename)
        .sort((a, b) => (b[1].startTime || 0) - (a[1].startTime || 0));
      return entries.length > 0 ? entries[0][0] : null;
    },

    getActiveScanTaskId: (state) => (filename) => {
      // Find the active (in_progress) task ID for this filename
      const entry = Object.entries(state.activeScans).find(([taskId, scan]) =>
        scan.filename === filename && scan.status === 'in_progress'
      );
      return entry ? entry[0] : null;
    },

    getScanByTaskId: (state) => (taskId) => {
      return state.activeScans[taskId] || null;
    },

    getActiveScanCount: (state) => {
      return Object.values(state.activeScans).filter(scan =>
        scan.status === 'in_progress'
      ).length;
    },

    getAllActiveScans: (state) => {
      return Object.entries(state.activeScans).map(([taskId, scan]) => ({
        taskId,
        ...scan
      }));
    },

    getScanProgress: (state) => (filename) => {
      const scan = Object.values(state.activeScans).find(scan =>
        scan.filename === filename && scan.status === 'in_progress'
      );
      return scan ? scan.progress || 0 : 0;
    },

    getRecentScanResult: (state) => (filename) => {
      return state.scanResults[filename] || null;
    },

    getScanDuration: (state) => (filename) => {
      const scan = Object.values(state.activeScans).find(scan =>
        scan.filename === filename
      );
      if (!scan) return 0;

      const endTime = scan.completedTime || scan.failedTime || Date.now();
      return endTime - scan.startTime;
    },

    // CodeViewer history getters
    canCodeViewerBack: (state) => state.codeViewerHistory.back.length > 0,
    canCodeViewerForward: (state) => state.codeViewerHistory.forward.length > 0,
  },
});
