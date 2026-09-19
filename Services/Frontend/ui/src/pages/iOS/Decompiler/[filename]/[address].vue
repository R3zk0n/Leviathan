<template>
  <div class="decompiler-container" :class="isDark ? 'theme--dark' : 'theme--light'">
    <!-- Rebase Dialog -->
    <v-dialog v-model="rebaseDialog" max-width="700px" persistent>
      <v-card class="modern-card" :class="isDark ? 'theme--dark' : 'theme--light'">
        <v-card-title class="headline d-flex align-center">
          <v-icon class="mr-2" color="primary">mdi-refresh</v-icon>
          Dynamic Address Rebase Configuration
          <v-spacer></v-spacer>
          <v-btn icon variant="text" @click="cancelRebase">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-card-title>

        <v-card-text class="pa-6">
          <div class="rebase-content">
            <v-alert
              type="info"
              variant="tonal"
              class="mb-6 rebase-alert"
              :class="isDark ? 'theme--dark' : 'theme--light'"
            >
              <div class="alert-content">
                <h4 class="mb-3">Quick Setup Guide</h4>
                <div class="setup-step mb-4">
                  <strong>Step 1:</strong> Get module base address from Frida:
                  <div class="code-block mt-2" :class="isDark ? 'theme--dark' : 'theme--light'">
                    <code>var modules = Process.enumerateModules();</code><br>
                    <code>var module = modules.find(m => m.name === "YourAppName");</code><br>
                    <code>console.log("Module Base:", module.base);</code>
                  </div>
                </div>
                <div class="setup-step">
                  <strong>Step 2:</strong> Copy the base address to the field below
                </div>
              </div>
            </v-alert>

            <div class="input-section mb-4">
              <v-text-field
                v-model="moduleOffsetInput"
                label="Module Base Address (from Frida)"
                placeholder="0x1042f4000"
                hint="Paste the exact base address from Frida console output"
                persistent-hint
                prepend-inner-icon="mdi-memory"
                @input="calculateRebaseOffset"
                variant="outlined"
                class="rebase-input"
                :class="isDark ? 'theme--dark' : 'theme--light'"
              />
            </div>

            <div class="input-section mb-4">
              <v-text-field
                v-model="originalBaseAddress"
                label="iOS Standard Base Address"
                hint="Standard iOS ASLR base address (fixed reference)"
                persistent-hint
                prepend-inner-icon="mdi-apple"
                readonly
                variant="outlined"
                class="rebase-input readonly"
                :class="isDark ? 'theme--dark' : 'theme--light'"
              />
            </div>

            <div v-if="rebaseOffsetValue !== 0" class="calculation-results">
              <v-alert
                type="success"
                variant="tonal"
                class="calculation-alert"
                :class="isDark ? 'theme--dark' : 'theme--light'"
              >
                <div class="calculation-content">
                  <h4 class="mb-3">✅ Rebase Calculation Success</h4>

                  <div class="calculation-formula mb-4">
                    <div class="formula-display">
                      <span class="address-value">{{ moduleOffsetInput }}</span>
                      <span class="operator">-</span>
                      <span class="address-value">{{ originalBaseAddress }}</span>
                      <span class="operator">=</span>
                      <span class="result-value">{{ rebaseOffset }}</span>
                    </div>
                  </div>

                  <div class="example-section mb-4">
                    <strong>Address Transformation Example:</strong>
                    <div class="transformation-display mt-2">
                      <span class="static-addr">Static: 0x1000046ac</span>
                      <v-icon class="mx-2" color="success">mdi-arrow-right</v-icon>
                      <span class="dynamic-addr">Dynamic: {{ formatExampleAddress() }}</span>
                    </div>
                  </div>

                  <div class="verification-section">
                    <strong>Frida Verification Command:</strong>
                    <div class="code-block mt-2" :class="isDark ? 'theme--dark' : 'theme--light'">
                      <code>console.log("Test address:", ptr("{{ moduleOffsetInput }}").add(ptr("0x1000046ac").sub(ptr("0x100000000"))));</code>
                      <v-btn
                        icon
                        size="small"
                        variant="text"
                        @click="copyVerificationCommand"
                        class="ml-2"
                      >
                        <v-icon size="16">mdi-content-copy</v-icon>
                      </v-btn>
                    </div>
                  </div>
                </div>
              </v-alert>
            </div>

            <div v-if="calculationError" class="error-section">
              <v-alert
                type="error"
                variant="tonal"
                class="error-alert"
                :class="isDark ? 'theme--dark' : 'theme--light'"
              >
                <div class="error-content">
                  <h4 class="mb-2">❌ Calculation Error</h4>
                  <p class="error-message">{{ calculationError }}</p>
                  <p class="error-hint">Please enter a valid hexadecimal address starting with 0x (e.g., 0x1042f4000)</p>
                </div>
              </v-alert>
            </div>
          </div>
        </v-card-text>

        <v-card-actions class="modern-actions pa-6" :class="isDark ? 'theme--dark' : 'theme--light'">
          <v-btn
            variant="text"
            @click="cancelRebase"
            class="mr-2"
          >
            Cancel
          </v-btn>
          <v-spacer />
          <v-btn
            color="primary"
            variant="elevated"
            @click="applyRebase"
            :disabled="!isValidRebaseConfiguration"
            prepend-icon="mdi-check"
          >
            Apply Rebase Configuration
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <div class="decompiler-layout">
      <!-- SIDEBAR -->
      <div
        class="sidebar-container"
        :class="isDark ? 'theme--dark' : 'theme--light'"
        :style="{ width: sidebarWidth + 'px' }"
      >
        <div class="sidebar-header" :class="isDark ? 'theme--dark' : 'theme--light'">
          <v-icon class="mr-2" size="20">mdi-file-tree</v-icon>
          <span class="sidebar-title">Analysis Tools</span>
        </div>

        <div
          class="panels-container"
          :style="{ '--dynamic-font-size': fontSize + 'px' }"
        >
          <!-- Methods Panel -->
          <div class="custom-panel">
            <div
              class="panel-header"
              :class="{'panel-active': activePanels.includes('methods')}"
              @click="togglePanel('methods')"
            >
              <div class="d-flex align-center">
                <v-icon size="16" class="mr-2">{{ activePanels.includes('methods') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                <span>Methods</span>
              </div>
            </div>

            <!-- Methods Content -->
            <div v-if="activePanels.includes('methods')" class="panel-content">
              <div v-if="loadingMethods" class="text-center pa-2">
                <v-progress-circular indeterminate color="primary" size="20" width="2" />
                <div class="caption mt-1">Loading methods...</div>
              </div>
              <div v-else-if="methodsError" class="error-message pa-2 caption">
                {{ methodsError }}
                <v-btn x-small text color="primary" @click="fetchMethods" class="mt-1">
                  Retry
                </v-btn>
              </div>
              <div v-else>
                <!-- Search Field -->
                <v-text-field
                  v-model="methodSearch"
                  dense
                  hide-details
                  prepend-inner-icon="mdi-magnify"
                  placeholder="Search methods..."
                  class="search-field mb-1 mt-1"
                  clearable
                  flat
                  single-line
                  outlined
                  height="28"
                ></v-text-field>

                <!-- Methods List -->
                <div class="methods-container">
                  <div v-for="(methods, className) in filteredMethodsByClass" :key="className" class="class-section">
                    <!-- Class Header -->
                    <div
                      class="class-header"
                      @click.stop="toggleClassExpanded(className)"
                    >
                      <v-icon size="14" class="mr-1">
                        {{ isClassExpanded(className) ? 'mdi-chevron-down' : 'mdi-chevron-right' }}
                      </v-icon>
                      <span class="class-name">{{ className }}</span>
                      <span class="method-count">{{ methods.length }}</span>
                    </div>

                    <!-- Method Items -->
                    <div v-if="isClassExpanded(className)" class="method-items">
                      <div
                        v-for="method in methods"
                        :key="method.imp_addr"
                        class="method-item"
                        :class="{'selected-method': isMethodSelected(method)}"
                        @click.stop="selectMethod(method)"
                        @contextmenu.prevent="onContextMenu({ event: $event, address: formatAddress(method.imp_addr), label: `${className}::${method.selector}` })"
                      >
                        <div class="method-content">
                          <span class="method-selector">{{ method.selector }}</span>
                          <span class="method-address">{{ formatAddress(method.imp_addr) }}</span>
                          <span v-if="isRebaseActive" class="method-address-rebased">
                            ({{ formatRebasedAddress(method.imp_addr) }})
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Functions Panel -->
          <div class="custom-panel">
            <div
              class="panel-header"
              :class="{'panel-active': activePanels.includes('functions')}"
              @click="togglePanel('functions')"
            >
              <div class="d-flex align-center">
                <v-icon size="16" class="mr-2">{{ activePanels.includes('functions') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                <span>Functions</span>
              </div>
            </div>

            <!-- Functions Content (extracted to components/iOS/FunctionsPanel.vue) -->
            <FunctionsPanel
              v-if="activePanels.includes('functions')"
              :filename="filename"
              :selected-function="selectedFunction"
              :is-dark="isDark"
              :is-rebase-active="isRebaseActive"
              :rebase-offset="rebaseOffsetValue"
              @select="viewFunction"
              @context-menu="onContextMenu"
            />
          </div>

          <!-- Strings Panel -->
          <div class="custom-panel">
            <div
              class="panel-header"
              :class="{'panel-active': activePanels.includes('strings')}"
              @click="togglePanel('strings')"
            >
              <div class="d-flex align-center">
                <v-icon size="16" class="mr-2">{{ activePanels.includes('strings') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                <span>Strings</span>
              </div>
            </div>


             <!-- Strings Content -->
             <div v-if="activePanels.includes('strings')" class="panel-content string-list">
               <div v-for="str in strings" :key="str"
                    class="string-item"
                    :class="{'selected-string': selectedString === str}"
                    @click="viewString(str)">
                 <span>{{ str }}</span>
               </div>
             </div>
           </div>

          <!-- Crypto Panel (extracted to components/iOS/CryptoPanel.vue) -->
          <div class="custom-panel">
            <div
              class="panel-header"
              :class="{'panel-active': activePanels.includes('crypto')}"
              @click="togglePanel('crypto')"
            >
              <div class="d-flex align-center">
                <v-icon size="16" class="mr-2">{{ activePanels.includes('crypto') ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
                <span>Crypto</span>
              </div>
            </div>

            <CryptoPanel
              v-if="activePanels.includes('crypto')"
              :filename="filename"
              :is-dark="isDark"
              :is-rebase-active="isRebaseActive"
              :rebase-offset="rebaseOffsetValue"
              @navigate="viewFunction"
              @copied="onChildCopied"
            />
          </div>
        </div>
      </div>

      <!-- Draggable divider — drag to resize the Analysis Tools panel -->
      <div
        class="sidebar-resizer"
        :class="{ 'sidebar-resizer--active': isResizingSidebar }"
        title="Drag to resize the Analysis Tools panel"
        @mousedown="startSidebarResize"
      ></div>

      <!-- MAIN CONTENT -->
      <div class="main-content-container" :class="isDark ? 'theme--dark' : 'theme--light'">
        <div class="main-content-card" :class="isDark ? 'theme--dark' : 'theme--light'">
          <div class="main-header" :class="isDark ? 'theme--dark' : 'theme--light'">
            <div class="header-content">
              <div class="header-info">
                <div class="decompiler-title">
                  <v-btn
                    icon
                    size="x-small"
                    variant="text"
                    :disabled="!canGoBack"
                    title="Back (previous location)"
                    class="nav-arrow"
                    @click="goBack"
                  >
                    <v-icon size="20">mdi-arrow-left</v-icon>
                  </v-btn>
                  <v-btn
                    icon
                    size="x-small"
                    variant="text"
                    :disabled="!canGoForward"
                    title="Forward"
                    class="nav-arrow mr-2"
                    @click="goForward"
                  >
                    <v-icon size="20">mdi-arrow-right</v-icon>
                  </v-btn>
                  <v-icon class="mr-2" color="primary">mdi-code-tags</v-icon>
                  <span>{{ currentViewType }} Disassembly</span>
                </div>
                <div class="address-info">
                  <div class="address-display">
                    <span class="label">Static Address:</span>
                    <code class="address-value static" :class="isDark ? 'theme--dark' : 'theme--light'">
                      {{ formatAddress(address) }}
                    </code>
                    <v-btn
                      icon
                      size="small"
                      variant="text"
                      @click="copyAddress(address)"
                      class="ml-1"
                    >
                      <v-icon size="16">mdi-content-copy</v-icon>
                    </v-btn>
                  </div>
                  <div v-if="isRebaseActive" class="address-display mt-1">
                    <span class="label">Dynamic Address:</span>
                    <code class="address-value dynamic" :class="isDark ? 'theme--dark' : 'theme--light'">
                      {{ formatRebasedAddress(address) }}
                    </code>
                    <v-btn
                      icon
                      size="small"
                      variant="text"
                      @click="copyAddress(formatRebasedAddress(address))"
                      class="ml-1"
                    >
                      <v-icon size="16">mdi-content-copy</v-icon>
                    </v-btn>
                  </div>
                </div>
                <div v-if="selectedMethod" class="method-info mt-2">
                  <v-chip color="primary" variant="tonal" size="small" class="method-chip">
                    <v-icon start size="16">mdi-function</v-icon>
                    {{ selectedMethod.class }}::{{ selectedMethod.selector }}
                  </v-chip>
                </div>
              </div>

              <div class="header-controls">
                <div class="controls-section">
                  <!-- Disassembly / Pseudocode view toggle -->
                  <v-btn-toggle
                    v-model="viewMode"
                    mandatory
                    variant="outlined"
                    density="comfortable"
                    class="mr-4 view-toggle"
                  >
                    <v-btn value="disassembly" size="small">
                      <v-icon start size="16">mdi-format-list-numbered</v-icon>
                      Disasm
                    </v-btn>
                    <v-btn value="pseudocode" size="small">
                      <v-icon start size="16">mdi-code-braces</v-icon>
                      Pseudocode
                    </v-btn>
                  </v-btn-toggle>

                  <!-- Font Size Controls -->
                  <div class="font-controls mr-4">
                    <v-chip
                      size="small"
                      variant="outlined"
                      class="mr-2 font-size-chip"
                      :class="isDark ? 'theme--dark' : 'theme--light'"
                    >
                      <v-icon start size="14">mdi-format-size</v-icon>
                      Font: {{ fontSize }}px
                    </v-chip>
                    <v-btn-group size="small" variant="outlined" density="comfortable" class="font-size-controls">
                      <v-btn
                        @click="decreaseFontSize"
                        :disabled="fontSize <= 10"
                        size="small"
                      >
                        <v-icon size="16">mdi-minus</v-icon>
                      </v-btn>
                      <v-btn
                        @click="resetFontSize"
                        size="small"
                      >
                        <v-icon size="16">mdi-refresh</v-icon>
                      </v-btn>
                      <v-btn
                        @click="increaseFontSize"
                        :disabled="fontSize >= 20"
                        size="small"
                      >
                        <v-icon size="16">mdi-plus</v-icon>
                      </v-btn>
                    </v-btn-group>
                  </div>

                  <!-- Rebase Controls -->
                  <div class="rebase-controls">
                    <v-chip
                      v-if="isRebaseActive"
                      color="success"
                      variant="tonal"
                      size="small"
                      class="mr-2 rebase-chip"
                    >
                      <v-icon start size="14">mdi-refresh</v-icon>
                      Rebased ({{ rebaseOffset }})
                    </v-chip>

                    <v-btn
                      size="small"
                      :color="isRebaseActive ? 'success' : 'primary'"
                      :variant="isRebaseActive ? 'tonal' : 'outlined'"
                      @click="openRebaseDialog"
                      class="mr-2 rebase-btn"
                    >
                      <v-icon start size="16">mdi-refresh</v-icon>
                      {{ isRebaseActive ? 'Update' : 'Configure' }} Rebase
                    </v-btn>

                    <v-btn
                      v-if="isRebaseActive"
                      size="small"
                      color="error"
                      variant="outlined"
                      @click="clearRebase"
                      class="clear-rebase-btn"
                    >
                      <v-icon start size="16">mdi-close</v-icon>
                      Clear
                    </v-btn>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            class="main-content"
            :class="isDark ? 'theme--dark' : 'theme--light'"
            :style="{ '--dynamic-font-size': fontSize + 'px' }"
          >
            <v-progress-circular v-if="loading" indeterminate color="primary" />
            <v-alert v-else-if="error" type="error">{{ error }}</v-alert>

            <!-- Pseudocode view (r2ghidra + resolved selectors) -->
            <div v-else-if="viewMode === 'pseudocode'" class="pseudocode-pane">
              <div v-if="pseudoLoading" class="text-center pa-8">
                <v-progress-circular indeterminate color="primary" size="28" width="3" />
                <div class="caption mt-2">Decompiling with r2ghidra…</div>
                <div class="caption pseudo-note">First time on this binary builds the selector map.</div>
              </div>
              <div v-else-if="pseudoError" class="pa-4 pseudo-error">
                {{ pseudoError }}
                <v-btn size="x-small" variant="text" color="primary" class="mt-1" @click="fetchPseudocode">Retry</v-btn>
              </div>
              <PseudocodeViewer
                v-else
                :code="pseudocodeText"
                :is-dark="isDark"
                :font-size="fontSize"
              />
            </div>

            <!-- 1) Show disassembly if loaded -->
            <div v-else-if="disassemblyJson">
              <!-- Optional prefix lines -->
              <div v-if="disassemblyJson.prefix?.length">
                <p v-for="(line, idx) in disassemblyJson.prefix" :key="idx">
                  {{ line }}
                </p>
              </div>

              <!-- ROW 1: Text-based listing of blocks (full width) -->
              <v-row>
                <v-col cols="12">
                  <div v-if="groupedBlocks.length">
                    <div
                      v-for="(block, blockIndex) in groupedBlocks"
                      :key="blockIndex"
                      class="basic-block-wrapper"
                    >
                      <!-- Basic Block Header -->
                      <div class="basic-block-header">
                        Basic Block #{{ blockIndex + 1 }}:
                        {{ formatAddress(block[0].address) }}
                        <span v-if="isRebaseActive">
                          ({{ formatRebasedAddress(block[0].address) }})
                        </span>
                        →
                        {{ formatAddress(lastAddressInBlock(block)) }}
                        <span v-if="isRebaseActive">
                          ({{ formatRebasedAddress(lastAddressInBlock(block)) }})
                        </span>
                      </div>

                      <!-- Instructions in this block -->
                      <div class="block-instructions">
                        <div class="instruction-table" :class="{ 'has-rebase': isRebaseActive }">
                          <!-- Table Header -->
                          <div class="instruction-header">
                            <div class="col-address">Address</div>
                            <div v-if="isRebaseActive" class="col-dynamic">Dynamic</div>
                            <div class="col-instruction">Instruction</div>
                            <div class="col-comment">Comments</div>
                          </div>

                          <!-- Instructions -->
                          <div
                            v-for="instr in block"
                            :key="instr.address"
                            class="instruction-row"
                            :class="{ 'instruction-row--current': highlightedAddress === instr.address }"
                            :data-instr-addr="instr.address"
                          >
                            <!-- Static Address -->
                            <div class="col-address">
                              <code class="address-code" :class="isDark ? 'theme--dark' : 'theme--light'">
                                {{ formatAddress(instr.address) }}
                              </code>
                            </div>

                            <!-- Dynamic Address (if rebase active) -->
                            <div v-if="isRebaseActive" class="col-dynamic">
                              <code class="address-code dynamic" :class="isDark ? 'theme--dark' : 'theme--light'">
                                {{ formatRebasedAddress(instr.address) }}
                              </code>
                            </div>

                            <!-- Skip bytes column for cleaner look -->

                            <!-- Combined Instruction (Mnemonic + Operands) -->
                            <div class="col-instruction">
                              <span class="instruction-text">
                                <span class="mnemonic-text" :class="isDark ? 'theme--dark' : 'theme--light'">
                                  {{ instr.mnemonic }}
                                </span>
                                <span v-if="instr.operands.length > 0" class="operands-text" :class="isDark ? 'theme--dark' : 'theme--light'">
                                  <template v-for="(op, oi) in instr.operands" :key="oi">
                                    <span
                                      v-if="branchOperandTarget(instr, op)"
                                      class="operand-link"
                                      :title="`Go to ${branchOperandTarget(instr, op)}`"
                                      @click.stop="navigateToTarget(branchOperandTarget(instr, op))"
                                    >{{ op }}</span>
                                    <span v-else>{{ op }}</span><span v-if="oi < instr.operands.length - 1">, </span>
                                  </template>
                                </span>
                              </span>
                            </div>

                            <!-- Comments/Annotations -->
                            <div class="col-comment">
                              <span
                                v-if="hasValidComment(instr)"
                                class="comment-text"
                                :class="isDark ? 'theme--dark' : 'theme--light'"
                              >
                                <!-- Branch Instruction -->
                                <template v-if="instr.annotation?.type === 'ObjcBranchInstruction'">
                                  <template v-if="instr.annotation.is_local_branch">
                                    <span
                                      class="comment-link"
                                      :title="`Go to ${formatAddress(instr.annotation.destination_address)}`"
                                      @click.stop="navigateToTarget(instr.annotation.destination_address)"
                                    >
                                      <v-icon size="12" class="mr-1">mdi-arrow-right</v-icon>
                                      branch {{ formatAddress(instr.annotation.destination_address) }}
                                    </span>
                                    <span v-if="isRebaseActive" class="dynamic-comment">
                                      ({{ formatRebasedAddress(instr.annotation.destination_address) }})
                                    </span>
                                  </template>
                                  <template v-else-if="instr.annotation.symbol">
                                    <span
                                      class="external-badge"
                                      title="External symbol — resolved in the dyld shared cache, not in this binary"
                                    >
                                      <v-icon size="11" class="external-badge-icon">mdi-function</v-icon>
                                      <span class="external-badge-symbol">{{ instr.annotation.symbol }}<template v-if="instr.annotation.selector">::{{ instr.annotation.selector }}</template></span>
                                      <span class="external-badge-tag">ext</span>
                                    </span>
                                  </template>
                                </template>

                                <!-- String Load Instruction -->
                                <template v-else-if="instr.annotation?.type === 'StringLoad'">
                                  <v-icon size="12" class="mr-1">mdi-format-quote-close</v-icon>
                                  "{{ instr.annotation.string_value }}"
                                </template>

                                <!-- Obj-C message send resolved via __objc_stubs -->
                                <template v-else-if="instr.annotation?.type === 'ObjcSelectorStub'">
                                  <span
                                    class="msgsend-annotation"
                                    title="Obj-C message send — click to list cross-references to this selector"
                                    @click.stop="openSelectorXrefs(instr.annotation.selector, formatAddress(instr.address))"
                                  >
                                    <v-icon size="12" class="mr-1">mdi-message-arrow-right-outline</v-icon>
                                    {{ instr.annotation.selector }}
                                  </span>
                                </template>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- Show "Goes to Basic Block #X" if you like -->
                      <div
                        class="block-connections"
                        v-if="blockConnections[blockIndex]?.length"
                      >
                        <div
                          v-for="destIndex in blockConnections[blockIndex]"
                          :key="destIndex"
                        >
                          → Goes to Basic Block #{{ destIndex + 1 }}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div v-else>No instructions found.</div>
                </v-col>
              </v-row>

              <!-- ROW 2: Enhanced Control Flow Graph -->
              <v-row>
                <v-col cols="12">
                  <div ref="graphContainer" class="graph-container">
                    <!-- Graph Header -->
                    <div class="graph-header">
                      <v-icon size="16">mdi-sitemap</v-icon>
                      <span class="graph-title">Control Flow Graph</span>
                      <v-chip size="x-small" variant="tonal" color="primary">
                        {{ groupedBlocks.length }} blocks
                      </v-chip>
                    </div>

                    <!-- Graph Controls -->
                    <div class="graph-controls">
                      <div class="graph-control-btn" @click="centerGraph" title="Center Graph">
                        <v-icon size="16">mdi-center-focus-strong</v-icon>
                      </div>
                      <div class="graph-control-btn" @click="resetZoom" title="Reset Zoom">
                        <v-icon size="16">mdi-magnify</v-icon>
                      </div>
                      <div class="graph-control-btn" @click="fitToScreen" title="Fit to Screen">
                        <v-icon size="16">mdi-fit-to-screen</v-icon>
                      </div>
                    </div>

                    <!-- SVG will be injected here -->

                    <!-- Graph Legend -->
                    <div class="graph-legend">
                      <div class="legend-item">
                        <div class="legend-line unconditional"></div>
                        <span>Unconditional</span>
                      </div>
                      <div class="legend-item">
                        <div class="legend-line conditional"></div>
                        <span>Conditional</span>
                      </div>
                    </div>
                  </div>
                </v-col>
              </v-row>

              <!-- Frida Script Helper Section -->

            </div>
            <div v-else>
              No disassembly to show.
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Success snackbar for copy operations -->
    <v-snackbar
      v-model="copySnackbar"
      timeout="2000"
      color="success"
    >
      {{ copySnackbarText }}
    </v-snackbar>

    <!-- Right-click context menu for Methods / Functions -->
    <v-menu v-model="ctxOpen" :target="ctxTarget" location="end" :close-on-content-click="true">
      <v-list density="compact" class="ctx-list">
        <v-list-item prepend-icon="mdi-source-branch" title="List xrefs" @click="ctxListXrefs" />
        <v-list-item prepend-icon="mdi-content-copy" title="Copy address" @click="ctxCopyAddress" />
      </v-list>
    </v-menu>

    <!-- Cross-references dialog -->
    <XrefsDialog
      v-model="xrefsOpen"
      :filename="filename"
      :target="xrefsTarget"
      :is-dark="isDark"
      @navigate="goToXref"
    />
  </div>
</template>

<script setup>
/*
  1) Imports & setup
*/
import { ref, onMounted, onBeforeUnmount, computed, watch, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { useStore } from 'vuex';
import { useTheme } from 'vuetify';
import CryptoPanel from '@/components/iOS/CryptoPanel.vue';
import FunctionsPanel from '@/components/iOS/FunctionsPanel.vue';
import XrefsDialog from '@/components/iOS/XrefsDialog.vue';
import PseudocodeViewer from '@/components/iOS/PseudocodeViewer.vue';
import { groupInstructionsByRanges } from '@/utils/basicBlocks';

/*
  2) dagre-d3 + d3 for graph rendering
*/
import * as d3 from 'd3';
import dagreD3 from 'dagre-d3';

const route = useRoute();
const router = useRouter();
const store = useStore();

// Theme
const theme = useTheme();

// This app stores the user's theme preference in Vuex (state.isDark).
// The decompiler page relies heavily on `theme--dark` / `theme--light` classes,
// so we derive from Vuex first and only fall back to Vuetify internals.
const isDark = computed(() => {
  const storeIsDark = store?.getters?.isDark;
  if (typeof storeIsDark === 'boolean') return storeIsDark;
  if (typeof store?.state?.isDark === 'boolean') return store.state.isDark;

  const name = theme?.global?.name?.value;
  if (typeof name === 'string' && name.length) {
    return name.toLowerCase().includes('dark');
  }

  return !!theme?.global?.current?.value?.dark;
});

// Global UI state used across the template
const loading = ref(false);
const error = ref('');

// Disassembly ⇄ pseudocode view
const viewMode = ref('disassembly');
const pseudocodeText = ref('');
const pseudoLoading = ref(false);
const pseudoError = ref('');
const copySnackbar = ref(false);

// ── Resizable "Analysis Tools" sidebar ──────────────────────────────────────
// Long Obj-C selectors / function names often overflow the default width, so the
// divider between the sidebar and the disassembly is draggable. Width persists.
const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 760;
const isResizingSidebar = ref(false);
const sidebarWidth = ref((() => {
  const saved = parseInt(localStorage.getItem('iosDecompilerSidebarWidth'), 10);
  return Number.isNaN(saved) ? 300 : Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, saved));
})());

let resizeStartX = 0;
let resizeStartWidth = 0;

const onSidebarResizeMove = (e) => {
  const next = resizeStartWidth + (e.clientX - resizeStartX);
  sidebarWidth.value = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, next));
};

const onSidebarResizeEnd = () => {
  isResizingSidebar.value = false;
  document.removeEventListener('mousemove', onSidebarResizeMove);
  document.removeEventListener('mouseup', onSidebarResizeEnd);
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  localStorage.setItem('iosDecompilerSidebarWidth', String(sidebarWidth.value));
};

const startSidebarResize = (e) => {
  isResizingSidebar.value = true;
  resizeStartX = e.clientX;
  resizeStartWidth = sidebarWidth.value;
  document.addEventListener('mousemove', onSidebarResizeMove);
  document.addEventListener('mouseup', onSidebarResizeEnd);
  // Keep the col-resize cursor and kill text selection for the whole drag.
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  e.preventDefault();
};

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onSidebarResizeMove);
  document.removeEventListener('mouseup', onSidebarResizeEnd);
});
const copySnackbarText = ref('Address copied to clipboard!');
const fontSize = ref(12);

// Sidebar panel state (prevents `activePanels.includes(...)` from crashing on first render)
const activePanels = ref(['methods', 'functions', 'strings']);

// Rebase state used by the rebase dialog UI
const rebaseDialog = ref(false);
const moduleOffsetInput = ref('');
const originalBaseAddress = ref('0x100000000');
const rebaseOffsetValue = ref(0);
const isRebaseActive = ref(false);
const calculationError = ref('');

 /*
  Reactive references for core data
*/
const strings = ref([]);
const methods = ref([]);
const selectedFunction = ref('');
const selectedString = ref('');
const selectedMethod = ref(null);
const address = ref('');
const filename = ref('');
const disassemblyJson = ref(null);
const currentViewType = ref('Function');

// Method-specific state
const methodSearch = ref('');
const expandedClasses = reactive({});
const loadingMethods = ref(false);
const methodsError = ref('');

// Crypto panel state/logic now lives in components/iOS/CryptoPanel.vue.
// Show a copy confirmation when the panel emits `copied`.
const onChildCopied = (message) => {
  copySnackbarText.value = message || 'Copied to clipboard!';
  copySnackbar.value = true;
};

/*
  3) Refs
*/
const graphContainer = ref(null);

/*
  4) Computed properties
*/
const filteredMethodsByClass = computed(() => {
  const result = {};

  // If no methods, return empty object
  if (!methods.value || methods.value.length === 0) {
    return result;
  }

  // Group methods by class
  const grouped = {};
  methods.value.forEach(method => {
    if (!grouped[method.class]) {
      grouped[method.class] = [];
    }
    grouped[method.class].push(method);
  });

  // Apply filtering based on search term
  const searchTerm = methodSearch.value.toLowerCase();

  if (!searchTerm) {
    // No search term - just sort each class's methods
    Object.keys(grouped).forEach(className => {
      result[className] = grouped[className].sort((a, b) =>
        a.selector.localeCompare(b.selector)
      );
    });
  } else {
    // With search term - filter methods that match in class name or selector
    Object.keys(grouped).forEach(className => {
      // Include methods where selector matches search term
      const matchingMethods = grouped[className].filter(method =>
        method.selector.toLowerCase().includes(searchTerm) ||
        className.toLowerCase().includes(searchTerm)
      );

      // Only add class if it has matching methods
      if (matchingMethods.length > 0) {
        result[className] = matchingMethods.sort((a, b) =>
          a.selector.localeCompare(b.selector)
        );
      }
    });
  }

  return result;
});

const groupedBlocks = computed(() => {
  if (!disassemblyJson.value) return [];
  const { instructions, basic_block_boundaries } = disassemblyJson.value;
  if (!instructions || !basic_block_boundaries) return [];

  return groupInstructionsByRanges(instructions, basic_block_boundaries);
});

const blockConnections = computed(() => {
  const blocks = groupedBlocks.value;
  if (!blocks.length) return [];

  // Map block start address -> index
  const blockAddressToIndex = new Map();
  blocks.forEach((block, idx) => {
    blockAddressToIndex.set(block[0].address, idx);
  });

  // Build an array for each block
  const connections = blocks.map(() => []);

  blocks.forEach((block, i) => {
    block.forEach((instr) => {
      if (
        instr.annotation?.type === 'ObjcBranchInstruction' &&
        instr.annotation.is_local_branch &&
        typeof instr.annotation.destination_address === 'number'
      ) {
        const destIndex = blockAddressToIndex.get(instr.annotation.destination_address);
        if (destIndex !== undefined) {
          connections[i].push(destIndex);
        }
      } else {
        // Optionally parse the mnemonic for branch instructions if needed
      }
    });
  });

  return connections;
});

// Rebase computed properties
const rebaseOffset = computed(() => {
  return formatAddress(rebaseOffsetValue.value);
});

const isValidRebaseConfiguration = computed(() => {
  return isValidHexInput(moduleOffsetInput.value) && rebaseOffsetValue.value !== 0 && !calculationError.value;
});

/*
  5) Methods
*/

// Format address as hex with 0x prefix
const formatAddress = (addr) => {
  if (addr === undefined || addr === null) return '';
  if (typeof addr === 'string') {
    // Handle hex string inputs
    const parsed = parseInt(addr, 16);
    if (isNaN(parsed)) return addr;
    return `0x${parsed.toString(16)}`;
  }
  return `0x${addr.toString(16)}`;
};

// Format rebased address
const formatRebasedAddress = (addr) => {
  if (!isRebaseActive.value) return '';
  if (addr === undefined || addr === null) return '';

  let numericAddr = addr;
  if (typeof addr === 'string') {
    numericAddr = parseInt(addr, 16);
    if (isNaN(numericAddr)) return addr;
  }

  const rebasedAddr = numericAddr + rebaseOffsetValue.value;
  return `0x${rebasedAddr.toString(16)}`;
};

// Validation functions
const isValidHexInput = (input) => {
  if (!input) return false;
  const hexPattern = /^0x[0-9a-fA-F]+$/;
  return hexPattern.test(input);
};

const validateHexInput = () => {
  // Trigger recalculation when input changes
  calculateRebaseOffset();
};

// Rebase functions
const openRebaseDialog = () => {
  rebaseDialog.value = true;
  calculationError.value = '';
  // Keep the original base fixed at iOS standard
  originalBaseAddress.value = '0x100000000';
};

const calculateRebaseOffset = () => {
  calculationError.value = '';

  if (!moduleOffsetInput.value) {
    rebaseOffsetValue.value = 0;
    return;
  }

  if (!isValidHexInput(moduleOffsetInput.value)) {
    calculationError.value = 'Invalid hex format. Use format: 0x1042f4000';
    rebaseOffsetValue.value = 0;
    return;
  }

  try {
    const moduleOffset = parseInt(moduleOffsetInput.value, 16);
    const originalBase = parseInt(originalBaseAddress.value, 16);

    if (isNaN(moduleOffset) || isNaN(originalBase)) {
      calculationError.value = 'Failed to parse hex addresses';
      rebaseOffsetValue.value = 0;
      return;
    }

    // Calculate the offset
    rebaseOffsetValue.value = moduleOffset - originalBase;

    console.log('Rebase calculation:', {
      moduleOffset: moduleOffsetInput.value,
      originalBase: originalBaseAddress.value,
      calculatedOffset: `0x${rebaseOffsetValue.value.toString(16)}`,
      offsetDecimal: rebaseOffsetValue.value
    });

  } catch (error) {
    calculationError.value = 'Calculation error: ' + error.message;
    rebaseOffsetValue.value = 0;
  }
};

const formatExampleAddress = () => {
  if (rebaseOffsetValue.value === 0) return '0x0';
  // Example: 0x1000046ac + offset
  const exampleStatic = parseInt('0x1000046ac', 16);
  const exampleDynamic = exampleStatic + rebaseOffsetValue.value;
  return `0x${exampleDynamic.toString(16)}`;
};

const applyRebase = () => {
  if (!isValidRebaseConfiguration.value) {
    return;
  }

  isRebaseActive.value = true;
  rebaseDialog.value = false;

  // Save to localStorage for persistence
  localStorage.setItem('leviathan_rebase_offset', rebaseOffsetValue.value.toString());
  localStorage.setItem('leviathan_module_offset', moduleOffsetInput.value);
  localStorage.setItem('leviathan_original_base', originalBaseAddress.value);

  console.log('Applied rebase configuration:', {
    moduleBase: moduleOffsetInput.value,
    offset: `0x${rebaseOffsetValue.value.toString(16)}`,
    active: true
  });
};

const cancelRebase = () => {
  rebaseDialog.value = false;
  // Reset input to current values
  if (isRebaseActive.value) {
    const savedModuleOffset = localStorage.getItem('leviathan_module_offset');
    if (savedModuleOffset) {
      moduleOffsetInput.value = savedModuleOffset;
    }
  }
};

const clearRebase = () => {
  isRebaseActive.value = false;
  rebaseOffsetValue.value = 0;
  moduleOffsetInput.value = '';

  // Clear from localStorage
  localStorage.removeItem('leviathan_rebase_offset');
  localStorage.removeItem('leviathan_module_offset');
  localStorage.removeItem('leviathan_original_base');
};

// Generate Frida script
const generateFridaScript = () => {
  const currentAddr = formatRebasedAddress(address.value);
  const methodName = selectedMethod.value ?
    `${selectedMethod.value.class}::${selectedMethod.value.selector}` :
    `function_${address.value}`;

  return `// Frida script for ${methodName}
// Module base: ${moduleOffsetInput.value}
// Static address: ${formatAddress(address.value)}
// Dynamic address: ${currentAddr}

const moduleBase = Module.findBaseAddress("YourAppName");
console.log("Module base:", moduleBase);

const targetAddress = moduleBase.add(${formatAddress(address.value)});
console.log("Target address:", targetAddress);

Interceptor.attach(targetAddress, {
    onEnter: function(args) {
        console.log("[+] ${methodName} called");
        console.log("    args[0] (self):", args[0]);
        console.log("    args[1] (selector):", args[1]);
        // Add more argument logging as needed
    },
    onLeave: function(retval) {
        console.log("[+] ${methodName} returns:", retval);
    }
});`;
};

const copyFridaScript = () => {
  navigator.clipboard.writeText(generateFridaScript()).then(() => {
    console.log('Frida script copied to clipboard');
  });
};

// Copy address to clipboard
const copyAddress = async (address) => {
  try {
    await navigator.clipboard.writeText(address);
    copySnackbarText.value = 'Address copied to clipboard!';
    copySnackbar.value = true;
  } catch (err) {
    console.error('Failed to copy address:', err);
  }
};

// Copy verification command
const copyVerificationCommand = async () => {
  const command = `console.log("Test address:", ptr("${moduleOffsetInput.value}").add(ptr("0x1000046ac").sub(ptr("0x100000000"))));`;
  try {
    await navigator.clipboard.writeText(command);
    copySnackbarText.value = 'Command copied to clipboard!';
    copySnackbar.value = true;
  } catch (err) {
    console.error('Failed to copy verification command:', err);
  }
};

// Graph control functions
let currentZoom = null;
let currentSvg = null;

const centerGraph = () => {
  if (currentSvg && currentZoom) {
    const svg = currentSvg.node();
    const bounds = svg.getBBox();
    const parent = svg.parentElement;
    const fullWidth = parent.clientWidth;
    const fullHeight = parent.clientHeight;
    const width = bounds.width;
    const height = bounds.height;
    const midX = bounds.x + width / 2;
    const midY = bounds.y + height / 2;

    const scale = 0.8 / Math.max(width / fullWidth, height / fullHeight);
    const translate = [fullWidth / 2 - scale * midX, fullHeight / 2 - scale * midY];

    currentSvg.transition().duration(750).call(
      currentZoom.transform,
      d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
    );
  }
};

const resetZoom = () => {
  if (currentSvg && currentZoom) {
    currentSvg.transition().duration(500).call(
      currentZoom.transform,
      d3.zoomIdentity
    );
  }
};

const fitToScreen = () => {
  if (currentSvg && currentZoom) {
    const svg = currentSvg.node();
    const bounds = svg.getBBox();
    const parent = svg.parentElement;
    const fullWidth = parent.clientWidth;
    const fullHeight = parent.clientHeight;
    const width = bounds.width;
    const height = bounds.height;

    const scale = 0.9 / Math.max(width / fullWidth, height / fullHeight);
    const translate = [
      (fullWidth - scale * width) / 2 - scale * bounds.x,
      (fullHeight - scale * height) / 2 - scale * bounds.y
    ];

    currentSvg.transition().duration(750).call(
      currentZoom.transform,
      d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
    );
  }
};

// Font size controls
const increaseFontSize = () => {
  if (fontSize.value < 20) {
    fontSize.value += 1;
    saveFontSize();
  }
};

const decreaseFontSize = () => {
  if (fontSize.value > 10) {
    fontSize.value -= 1;
    saveFontSize();
  }
};

const resetFontSize = () => {
  fontSize.value = 12;
  saveFontSize();
};

const saveFontSize = () => {
  localStorage.setItem('decompiler_font_size', fontSize.value.toString());
};

const loadFontSize = () => {
  const savedSize = localStorage.getItem('decompiler_font_size');
  if (savedSize) {
    fontSize.value = parseInt(savedSize, 10);
  }
};

// Check if instruction has valid comment
const hasValidComment = (instr) => {
  if (!instr.annotation?.type) return false;

  if (instr.annotation.type === 'ObjcBranchInstruction') {
    return (instr.annotation.is_local_branch && instr.annotation.destination_address) ||
           (instr.annotation.symbol && instr.annotation.symbol.trim() !== '');
  }

  if (instr.annotation.type === 'StringLoad') {
    return instr.annotation.string_value && instr.annotation.string_value.trim() !== '';
  }

  if (instr.annotation.type === 'ObjcSelectorStub') {
    return !!instr.annotation.selector;
  }

  return false;
};

// Panel management
const togglePanel = (panel) => {
  console.log(`Toggling panel: ${panel}, current activePanels:`, activePanels.value);

  // If this panel is already active, close it (empty the array)
  if (activePanels.value.includes(panel)) {
    activePanels.value = [];
    console.log('Closing panel because it was already active');
  } else {
    // Otherwise, set only this panel as active
    activePanels.value = [panel];

    // Load data for this panel if needed
    if (panel === 'methods' && (!methods.value || methods.value.length === 0)) {
      fetchMethods();
    } else if (panel === 'strings' && (!strings.value || strings.value.length === 0)) {
      fetchStrings();
    }
    // 'functions' and 'crypto' fetch themselves on mount (FunctionsPanel/CryptoPanel).

    console.log('Opening panel', panel);
  }

  // Save panel state
  localStorage.setItem('activePanels', JSON.stringify(activePanels.value));
};

// Class expansion methods
const isClassExpanded = (className) => {
  return !!expandedClasses[className];
};

const toggleClassExpanded = (className) => {
  expandedClasses[className] = !expandedClasses[className];
};

// Method selection
const isMethodSelected = (method) => {
  return selectedMethod.value?.imp_addr === method.imp_addr;
};

const selectMethod = (method) => {
  viewMethod(method);
};

// Helper: last address in a block
const lastAddressInBlock = (block) => {
  if (!block?.length) return 0;
  return block[block.length - 1].address;
};

/*
  6) API Methods
*/
const fetchMethods = async () => {
  try {
    console.log(`Fetching methods for file: ${filename.value}`);
    loadingMethods.value = true;
    methodsError.value = '';

    const response = await axios.get(
      `${import.meta.env.VITE_APP_API_URL}/disas/disassemble/ios/${filename.value}/methods`
    );

    console.log('Methods response:', response.data);

    let methodsData = [];

    // Parse the methods JSON if it comes as a string
    if (typeof response.data.methods === 'string') {
      try {
        methodsData = JSON.parse(response.data.methods);
      } catch (parseErr) {
        console.error('Error parsing methods JSON:', parseErr);
        methodsError.value = 'Error parsing methods data';
        return;
      }
    } else if (Array.isArray(response.data.methods)) {
      methodsData = response.data.methods;
    }

    // Assign to the reactive property
    methods.value = methodsData;

    console.log('Parsed methods:', methods.value);

    // Initialize expanded state for classes
    const classNames = [...new Set(methods.value.map(m => m.class))];
    classNames.forEach((className) => {
      if (expandedClasses[className] === undefined) {
        expandedClasses[className] = false;
      }
    });

    // If we have ViewControllers, expand that one by default
    if (classNames.includes('ViewController')) {
      expandedClasses['ViewController'] = true;
    }

  } catch (err) {
    console.error('Error fetching methods:', err);
    methodsError.value = `Error fetching methods: ${err.message}`;
  } finally {
    loadingMethods.value = false;
  }
};

const fetchStrings = async () => {
  try {
    const response = await axios.get(
      `${import.meta.env.VITE_APP_API_URL}/disas/disassemble/ios/${filename.value}/strings`
    );
    strings.value = response.data.strings;
  } catch (err) {
    console.error('Error fetching strings:', err);
    error.value = 'Error fetching strings';
  }
};

const jumpToAddress = (addr) => {
  if (addr === undefined || addr === null) return;
  viewFunction(formatAddress(addr));
};

// ARM64 mnemonics whose operand carries a branch/call target address.
const isBranchMnemonic = (m) => {
  if (!m) return false;
  const x = String(m).toLowerCase();
  return x === 'b' || x === 'bl' || x === 'br' || x === 'blr'
    || x.startsWith('b.') || x === 'cbz' || x === 'cbnz'
    || x === 'tbz' || x === 'tbnz';
};

// A call into an imported symbol (e.g. `bl _objc_storeStrong`): the target is a
// stub that trampolines into the dyld shared cache, so it isn't disassemblable in
// this binary. We render these as an "external" badge and never as a nav link.
const isExternalCall = (instr) => {
  const a = instr?.annotation;
  return a?.type === 'ObjcBranchInstruction' && a.is_local_branch === false && !!a.symbol;
};

// If `op` is a code address on a branch/call instruction, return the normalized
// "0x..." target so it can be made clickable; otherwise null (plain operand).
// Only branch/call mnemonics qualify (so immediates like `#0xb0` on `sub sp,...`
// are never treated as targets), and external import calls are excluded so their
// operand doesn't become a dead-end link that 500s.
const branchOperandTarget = (instr, op) => {
  if (!instr || !isBranchMnemonic(instr.mnemonic)) return null;
  if (isExternalCall(instr)) return null;
  const match = String(op).match(/#?(0x[0-9a-fA-F]+)/);
  return match ? formatAddress(match[1]) : null;
};

/*
  7) View function / string / method
*/
// Highlighted ("you are here") instruction address, set when we scroll to an
// intra-function branch target. Reset whenever a new function loads.
const highlightedAddress = ref(null);

// ── Back/forward navigation history (browser-style, essential for RE) ────────
const navStack = ref([]);       // addresses viewed, in order
const navPos = ref(-1);         // current index into navStack
let navigatingHistory = false;  // true while replaying back/forward (don't re-record)

const canGoBack = computed(() => navPos.value > 0);
const canGoForward = computed(() => navPos.value < navStack.value.length - 1);

const recordNav = (addr) => {
  if (navigatingHistory || !addr) return;
  if (navStack.value[navPos.value] === addr) return;  // already here
  navStack.value = navStack.value.slice(0, navPos.value + 1);  // drop forward history
  navStack.value.push(addr);
  navPos.value = navStack.value.length - 1;
};

const goBack = () => {
  if (!canGoBack.value) return;
  navPos.value -= 1;
  navigatingHistory = true;
  Promise.resolve(viewFunction(navStack.value[navPos.value]))
    .finally(() => { navigatingHistory = false; });
};

const goForward = () => {
  if (!canGoForward.value) return;
  navPos.value += 1;
  navigatingHistory = true;
  Promise.resolve(viewFunction(navStack.value[navPos.value]))
    .finally(() => { navigatingHistory = false; });
};

const viewFunction = async (func) => {
  recordNav(func);
  selectedFunction.value = func;
  selectedString.value = '';
  selectedMethod.value = null;
  address.value = func;
  currentViewType.value = 'Function';
  loading.value = true;
  error.value = '';
  disassemblyJson.value = null;
  highlightedAddress.value = null;

  // Update route without reloading
  router.push({
    name: router.currentRoute.value.name,
    params: {
      ...router.currentRoute.value.params,
      address: func
    }
  });

  try {
    const response = await axios.get(
      `${import.meta.env.VITE_APP_API_URL}/disas/disassemble/ios/${filename.value}/${address.value}`
    );
    disassemblyJson.value = response.data.disassembly;

    // Draw graph after data is loaded
    setTimeout(() => {
      drawGraph();
    }, 100);
  } catch (err) {
    console.error('Error fetching disassembled code:', err);
    // Surface the backend's actual reason (e.g. "outside valid binary segments",
    // "invalid file offset") instead of a generic message. Most common cause:
    // the address is a mid-function block or an import stub that trampolines into
    // the dyld shared cache, so there's no analyzable function to disassemble here.
    const backendMsg = err?.response?.data?.message;
    error.value = backendMsg
      ? `Can't disassemble ${func} — ${backendMsg} Try the Pseudocode tab — it uses a different engine (r2ghidra) that often handles entry points and edge functions the disassembler chokes on.`
      : `Error fetching disassembled code for ${func}. Try the Pseudocode tab.`;
  } finally {
    loading.value = false;
  }
};

// Addresses of every instruction in the function currently on screen.
const currentInstrAddresses = computed(() => {
  const set = new Set();
  const instrs = disassemblyJson.value?.instructions;
  if (Array.isArray(instrs)) {
    for (const i of instrs) set.add(i.address);
  }
  return set;
});

// Navigate to a branch/call target. If it's inside the function already on
// screen (an intra-function jump like `cbz ..., #0x...`), scroll+highlight that
// instruction instead of reloading — the backend can only disassemble from a
// *function start*, so reloading a mid-function block 500s. Otherwise load it as
// a new function.
const navigateToTarget = (target) => {
  const addrInt = typeof target === 'number' ? target : parseInt(target, 16);
  if (Number.isNaN(addrInt)) return;

  if (currentInstrAddresses.value.has(addrInt)) {
    highlightedAddress.value = addrInt;
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-instr-addr="${addrInt}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return;
  }
  viewFunction(typeof target === 'number' ? formatAddress(target) : target);
};

// ── Right-click context menu + cross-references ─────────────────────────────
const ctxOpen = ref(false);
const ctxTarget = ref([0, 0]);          // [x, y] screen coords for the v-menu
const ctxCurrent = ref(null);           // { address, label } of the right-clicked item
const xrefsOpen = ref(false);
const xrefsTarget = ref(null);          // { address, label } passed to XrefsDialog

const onContextMenu = ({ event, address, label }) => {
  ctxCurrent.value = { address, label };
  ctxTarget.value = [event.clientX, event.clientY];
  // Re-open on the next tick so the menu repositions if it was already open.
  ctxOpen.value = false;
  requestAnimationFrame(() => { ctxOpen.value = true; });
};

const ctxListXrefs = () => {
  if (!ctxCurrent.value) return;
  xrefsTarget.value = { ...ctxCurrent.value };
  xrefsOpen.value = true;
};

// Clicking a resolved message-send selector in the disassembly → its xrefs.
const openSelectorXrefs = (selector, address) => {
  if (!selector) return;
  xrefsTarget.value = { address, label: selector, selector };
  xrefsOpen.value = true;
};

const ctxCopyAddress = () => {
  if (ctxCurrent.value?.address) copyAddress(ctxCurrent.value.address);
};

// Navigate to a chosen cross-reference: load the calling function, then scroll to
// and highlight the exact call site once the disassembly has rendered.
const goToXref = async ({ func, addr }) => {
  await viewFunction(func);
  const addrInt = parseInt(addr, 16);
  if (Number.isNaN(addrInt)) return;
  setTimeout(() => {
    highlightedAddress.value = addrInt;
    const el = document.querySelector(`[data-instr-addr="${addrInt}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 200);
};

const viewString = (str) => {
  selectedString.value = str;
  selectedFunction.value = '';
  selectedMethod.value = null;
};

// Decompile the current function to pseudocode (r2ghidra + resolved selectors).
const fetchPseudocode = async () => {
  if (!filename.value || !address.value) return;
  pseudoLoading.value = true;
  pseudoError.value = '';
  try {
    const addr = formatAddress(address.value);
    const url = `${import.meta.env.VITE_APP_API_URL}/ios/pseudocode/${encodeURIComponent(filename.value)}/${addr}`;
    const resp = await axios.get(url);
    if (resp.data?.ready) {
      pseudocodeText.value = resp.data.code;
    } else {
      pseudocodeText.value = '';
      pseudoError.value = resp.data?.message || 'No pseudocode available for this function.';
    }
  } catch (e) {
    pseudoError.value = e?.response?.data?.message || e?.message || 'Failed to decompile.';
  } finally {
    pseudoLoading.value = false;
  }
};

// Fetch when the user switches to pseudocode, or navigates to a new function while in it.
watch(() => [viewMode.value, address.value], ([mode]) => {
  if (mode === 'pseudocode') fetchPseudocode();
});

const viewMethod = async (method) => {
  console.log('Viewing method:', method);
  recordNav(formatAddress(method.imp_addr));
  selectedMethod.value = method;
  selectedFunction.value = '';
  selectedString.value = '';
  address.value = method.imp_addr;
  currentViewType.value = 'Method';
  loading.value = true;
  error.value = '';
  disassemblyJson.value = null;

  // Update route without reloading
  router.push({
    name: router.currentRoute.value.name,
    params: {
      ...router.currentRoute.value.params,
      address: method.imp_addr
    }
  });

  try {
    console.log(`Viewing method at address: ${method.imp_addr}`);
    const response = await axios.get(
      `${import.meta.env.VITE_APP_API_URL}/disas/disassemble/ios/${filename.value}/${method.imp_addr}`
    );
    disassemblyJson.value = response.data.disassembly;

    // Draw graph after data is loaded
    setTimeout(() => {
      drawGraph();
    }, 100);
  } catch (err) {
    console.error('Error fetching disassembled code:', err);
    error.value = 'Error fetching disassembled code';
  } finally {
    loading.value = false;
  }
};

/*
  8) Edge styling
*/
function getEdgeStyle(instr) {
  // Enhanced edge styling with better visual distinction
  const isConditional = /cbz|tbz|tbnz|b\.(eq|ne|gt|lt|ge|le)/i.test(instr.mnemonic);
  if (isConditional) {
    return {
      label: "conditional",
      style: "stroke: #f59e0b; fill: none; stroke-width: 2px; stroke-dasharray: 5,5;",
      arrowheadStyle: "fill: #f59e0b; stroke: #f59e0b;",
      class: "conditional"
    };
  } else {
    return {
      label: "",
      style: "stroke: #6366f1; fill: none; stroke-width: 2px;",
      arrowheadStyle: "fill: #6366f1; stroke: #6366f1;",
      class: "unconditional"
    };
  }
}

/*
  9) Enhanced Graph rendering with better styling and interactivity
*/
function drawGraph() {
  if (!graphContainer.value) return;

  const blocks = groupedBlocks.value;
  const connections = blockConnections.value;
  if (!blocks.length) return;

  // Create a new graph with better layout
  const g = new dagreD3.graphlib.Graph()
    .setGraph({
      rankdir: 'TB', // Top to bottom for better readability
      marginx: 40,
      marginy: 40,
      nodesep: 50,
      edgesep: 20,
      ranksep: 80
    })
    .setDefaultEdgeLabel(() => ({}));

  // Add enhanced nodes
  blocks.forEach((block, blockIndex) => {
    // Create more compact and readable labels
    const firstAddr = formatAddress(block[0].address);
    const lastAddr = formatAddress(block[block.length - 1].address);

    // Create instruction summary (first few instructions)
    const instructionsPreview = block.slice(0, 5).map((instr) => {
      let line = `${formatAddress(instr.address).slice(-4)}: ${instr.mnemonic}`;
      if (instr.operands.length > 0) {
        const operands = instr.operands.join(', ');
        if (operands.length > 20) {
          line += ` ${operands.substring(0, 20)}...`;
        } else {
          line += ` ${operands}`;
        }
      }
      return line;
    });

    if (block.length > 5) {
      instructionsPreview.push(`... (${block.length - 5} more)`);
    }

    const label = `Block ${blockIndex + 1}\n${firstAddr} - ${lastAddr}\n${instructionsPreview.join('\n')}`;

    // Enhanced node styling based on theme
    const nodeStyle = isDark.value
      ? "fill: #1e293b; stroke: #6366f1; stroke-width: 2px; rx: 8px; ry: 8px;"
      : "fill: #ffffff; stroke: #6366f1; stroke-width: 2px; rx: 8px; ry: 8px;";

    const labelStyle = isDark.value
      ? "white-space: pre; fill: #e2e8f0; font-size: 11px; font-family: Monaco, monospace;"
      : "white-space: pre; fill: #1e293b; font-size: 11px; font-family: Monaco, monospace;";

    g.setNode(blockIndex, {
      label,
      style: nodeStyle,
      labelStyle: labelStyle,
      width: 200,
      height: Math.max(80, instructionsPreview.length * 15 + 40)
    });
  });

  // Add enhanced edges with better styling
  connections.forEach((destBlocks, srcIndex) => {
    // Find branching instruction for edge styling
    const branchInstr = blocks[srcIndex].find(
      (instr) =>
        instr.annotation?.type === 'ObjcBranchInstruction' &&
        instr.annotation.is_local_branch
    );

    destBlocks.forEach((dstIndex) => {
      let edgeStyle = {};
      let edgeClass = "";

      if (branchInstr && /cbz|tbz|tbnz|b\.(eq|ne|gt|lt|ge|le)/i.test(branchInstr.mnemonic)) {
        // Conditional branch
        edgeStyle = {
          style: "stroke: #f59e0b; fill: none; stroke-width: 2px; stroke-dasharray: 5,5;",
          arrowheadStyle: "fill: #f59e0b; stroke: #f59e0b;",
          label: "conditional"
        };
        edgeClass = "conditional";
      } else {
        // Unconditional branch
        edgeStyle = {
          style: "stroke: #6366f1; fill: none; stroke-width: 2px;",
          arrowheadStyle: "fill: #6366f1; stroke: #6366f1;",
          label: ""
        };
        edgeClass = "unconditional";
      }

      g.setEdge(srcIndex, dstIndex, { ...edgeStyle, class: edgeClass });
    });
  });

  // Clear container and create SVG
  const containerEl = graphContainer.value;
  containerEl.innerHTML = "";

  const svg = d3.select(containerEl)
    .append("svg")
    .attr("class", "cfg-svg")
    .attr("width", "100%")
    .attr("height", "500px");

  const inner = svg.append("g");

  // Render the graph
  const render = new dagreD3.render();
  render(inner, g);

  // Enhanced pan & zoom with constraints
  const zoom = d3.zoom()
    .scaleExtent([0.1, 3])
    .on("zoom", (event) => {
      inner.attr("transform", event.transform);
    });

  svg.call(zoom);

  // Store references for controls
  currentSvg = svg;
  currentZoom = zoom;

  // Apply edge classes for styling
  inner.selectAll(".edgePath").each(function(d) {
    const edge = g.edge(d);
    if (edge.class) {
      d3.select(this).classed(edge.class, true);
    }
  });

  // Add hover effects to nodes
  inner.selectAll("g.node")
    .on("mouseenter", function() {
      d3.select(this).select("rect")
        .transition()
        .duration(200)
        .attr("stroke-width", "3px")
        .style("filter", "drop-shadow(0 4px 8px rgba(99, 102, 241, 0.3))");
    })
    .on("mouseleave", function() {
      d3.select(this).select("rect")
        .transition()
        .duration(200)
        .attr("stroke-width", "2px")
        .style("filter", "none");
    })
    .style("cursor", "pointer");

  // Add tooltips
  inner.selectAll("g.node").append("title").text(function(d) {
    const block = blocks[d];
    return `Basic Block ${d + 1}\nInstructions: ${block.length}\nRange: ${formatAddress(block[0].address)} - ${formatAddress(block[block.length - 1].address)}`;
  });

  // Auto-fit the graph initially
  setTimeout(() => {
    fitToScreen();
  }, 100);
}

/*
  10) Watch for changes -> drawGraph
*/
watch([groupedBlocks, blockConnections], () => {
  drawGraph();
});

/*
  11) onMounted
*/
onMounted(() => {
  filename.value = route.params.filename;
  address.value = route.params.address || '';

  console.log('Component mounted with filename:', filename.value);

  // Load rebase settings from localStorage
  const savedOffset = localStorage.getItem('leviathan_rebase_offset');
  const savedModuleOffset = localStorage.getItem('leviathan_module_offset');
  const savedOriginalBase = localStorage.getItem('leviathan_original_base');

  if (savedOffset && savedModuleOffset && savedOriginalBase) {
    rebaseOffsetValue.value = parseInt(savedOffset);
    moduleOffsetInput.value = savedModuleOffset;
    originalBaseAddress.value = savedOriginalBase;
    isRebaseActive.value = true;
  }

  // Load font size settings
  loadFontSize();

  // Open methods panel by default
  activePanels.value.push('methods');

  // Fetch methods on load
  fetchMethods();

  // Only load disassembly if we have an address
  if (address.value) {
    // Check if this is a method address
    setTimeout(() => {
      const methodMatch = methods.value.find(m => m.imp_addr === address.value);
      if (methodMatch) {
        viewMethod(methodMatch);
      } else {
        viewFunction(address.value);
      }
    }, 500); // Allow time for methods to load
  }

  // Persist panel state in localStorage if needed
  const savedPanels = localStorage.getItem('activePanels');
  if (savedPanels) {
    try {
      const parsed = JSON.parse(savedPanels);
      if (Array.isArray(parsed)) {
        activePanels.value = parsed;
      }
    } catch (e) {
      console.error('Error parsing saved panels state', e);
    }
  }

  // Save panel state when it changes
  watch(activePanels, (newValue) => {
    localStorage.setItem('activePanels', JSON.stringify(newValue));
  }, { deep: true });

  // Watch font size changes to update CSS custom properties
  watch(fontSize, (newSize) => {
    // Update CSS custom properties for dynamic font sizing
    document.documentElement.style.setProperty('--decompiler-font-size', newSize + 'px');
  }, { immediate: true });
});
</script>

<style scoped>
/* === BINARY NINJA INSPIRED LAYOUT === */

/* Hide browser scrollbar */
:global(html) {
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

:global(html::-webkit-scrollbar) {
  display: none; /* Chrome, Safari, Opera */
}

:global(body) {
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

:global(body::-webkit-scrollbar) {
  display: none; /* Chrome, Safari, Opera */
}

/* Main Container */
.decompiler-container {
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Layout Structure */
.decompiler-layout {
  display: flex;
  flex: 1;
  height: calc(100vh - 64px); /* Account for app bar */
  overflow: hidden;
}

/* === LEFT SIDEBAR (Binary Ninja Style) === */
/* Width is driven by an inline style (sidebarWidth) via the draggable divider. */
.sidebar-container {
  flex: 0 0 auto;
  min-width: 180px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(0, 0, 0, 0.12);
  overflow: hidden;
}

/* Draggable divider between the sidebar and the main content */
.sidebar-resizer {
  flex: 0 0 5px;
  cursor: col-resize;
  background-color: transparent;
  position: relative;
  z-index: 5;
  transition: background-color 0.15s ease;
}
.sidebar-resizer:hover,
.sidebar-resizer--active {
  background-color: rgba(99, 102, 241, 0.5);
}
/* Wider invisible hit-area so the 5px strip is easy to grab */
.sidebar-resizer::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -3px;
  right: -3px;
}

.theme--dark .sidebar-container {
  background-color: #1e1e1e;
  border-right-color: rgba(255, 255, 255, 0.12);
}

.theme--light .sidebar-container {
  background-color: #f8fafc;
  border-right-color: rgba(0, 0, 0, 0.08);
}

/* Sidebar Header */
.sidebar-header {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  font-weight: 600;
  font-size: 14px;
}

.theme--dark .sidebar-header {
  background-color: #262626;
  border-bottom-color: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.theme--light .sidebar-header {
  background-color: #ffffff;
  border-bottom-color: rgba(0, 0, 0, 0.08);
  color: #000000;
}

.sidebar-title {
  font-weight: 600;
  font-size: 13px;
}

/* Panels Container */
.panels-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  --dynamic-font-size: 12px;
}

/* === PANEL STYLING (Binary Ninja Inspired) === */
.custom-panel {
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.theme--dark .custom-panel {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.panel-header {
  padding: 10px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  user-select: none;
  font-weight: 500;
  font-size: 13px;
  transition: all 0.2s ease;
  border-left: 3px solid transparent;
}

.theme--dark .panel-header {
  background-color: #2d2d2d;
  color: #ffffff;
  border-right: none;
}

.theme--light .panel-header {
  background-color: #ffffff;
  color: #000000;
}

.panel-header:hover {
  background-color: rgba(99, 102, 241, 0.05);
}

.theme--dark .panel-header:hover {
  background-color: rgba(99, 102, 241, 0.1);
}

.panel-active {
  border-left-color: #6366f1 !important;
  background-color: rgba(99, 102, 241, 0.08) !important;
}

.theme--dark .panel-active {
  background-color: rgba(99, 102, 241, 0.15) !important;
  color: #ffffff;
}

.panel-content {
  padding: 8px 0;
  max-height: 400px;
  overflow-y: auto;
  overflow-x: hidden;
}

.theme--dark .panel-content {
  background-color: #1e1e1e;
}

.theme--light .panel-content {
  background-color: #ffffff;
}

/* === METHODS PANEL === */
.search-field {
  margin: 8px 12px 12px 12px;
  font-size: 12px;
}

.theme--dark .search-field {
  --v-field-bg: #2d2d2d;
  --v-theme-surface: #2d2d2d;
}

.theme--light .search-field {
  --v-field-bg: #ffffff;
  --v-theme-surface: #ffffff;
}

.methods-container {
  padding: 0 8px;
}

.class-section {
  margin-bottom: 6px;
}

.class-header {
  padding: 6px 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  border-radius: 4px;
  transition: background-color 0.15s;
  user-select: none;
}

.theme--dark .class-header {
  background-color: rgba(255, 255, 255, 0.02);
}

.theme--light .class-header {
  background-color: rgba(0, 0, 0, 0.02);
}

.class-header:hover {
  background-color: rgba(99, 102, 241, 0.08);
}

.theme--dark .class-header:hover {
  background-color: rgba(99, 102, 241, 0.12);
}

.class-name {
  font-weight: 600;
  font-size: calc(var(--dynamic-font-size, 12px) * 0.9);
  margin-right: auto;
}

.theme--dark .class-name {
  color: #818cf8;
}

.theme--light .class-name {
  color: #1e40af;
}

.method-count {
  font-size: calc(var(--dynamic-font-size, 12px) * 0.75);
  opacity: 0.8;
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: 600;
}

.theme--dark .method-count {
  background-color: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}

.theme--light .method-count {
  background-color: rgba(0, 0, 0, 0.08);
  color: rgba(0, 0, 0, 0.7);
}

.method-items {
  margin-left: 16px;
  padding-left: 8px;
  margin-top: 4px;
  border-left: 1px solid rgba(99, 102, 241, 0.2);
}

.method-item {
  padding: 4px 8px;
  margin-bottom: 1px;
  cursor: pointer;
  font-size: 11px;
  border-radius: 3px;
  border-left: 2px solid transparent;
  transition: all 0.15s;
}

.method-item:hover {
  background-color: rgba(99, 102, 241, 0.05);
}

.theme--dark .method-item:hover {
  background-color: rgba(99, 102, 241, 0.08);
}

.method-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.method-selector {
  flex-grow: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: 8px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: calc(var(--dynamic-font-size, 12px) * 0.85);
  font-weight: 500;
}

.theme--dark .method-selector {
  color: #e5e7eb;
}

.theme--light .method-selector {
  color: #1f2937;
}

.method-address {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: calc(var(--dynamic-font-size, 12px) * 0.7);
  opacity: 0.8;
}

.theme--dark .method-address {
  color: #a78bfa;
}

.theme--light .method-address {
  color: #7c3aed;
  font-weight: 600;
}

.method-address-rebased {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: calc(var(--dynamic-font-size, 12px) * 0.65);
  opacity: 0.7;
  margin-left: 4px;
}

.theme--dark .method-address-rebased {
  color: #10b981;
}

.theme--light .method-address-rebased {
  color: #166534;
  font-weight: 600;
}

.selected-method {
  border-left-color: #6366f1;
  background-color: rgba(99, 102, 241, 0.12);
}

.theme--dark .selected-method {
  background-color: rgba(99, 102, 241, 0.18);
}

/* === FUNCTIONS AND STRINGS LISTS === */
.function-list, .string-list {
  padding: 0 8px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.function-item, .string-item {
  padding: 4px 8px;
  margin-bottom: 1px;
  cursor: pointer;
  border-radius: 3px;
  border-left: 2px solid transparent;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: calc(var(--dynamic-font-size, 12px) * 0.85);
  transition: all 0.15s;
}

.function-item:hover, .string-item:hover {
  background-color: rgba(99, 102, 241, 0.05);
}

.theme--dark .function-item:hover,
.theme--dark .string-item:hover {
  background-color: rgba(99, 102, 241, 0.08);
}

.selected-function, .selected-string {
  background-color: rgba(99, 102, 241, 0.12);
  border-left-color: #6366f1;
}

.theme--dark .selected-function,
.theme--dark .selected-string {
  background-color: rgba(99, 102, 241, 0.18);
}

.function-address-rebased {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: calc(var(--dynamic-font-size, 12px) * 0.65);
  opacity: 0.7;
  margin-left: 4px;
}

.theme--dark .function-address-rebased {
  color: #10b981;
}

.theme--light .function-address-rebased {
  color: #166534;
  font-weight: 600;
}

/* === MAIN CONTENT AREA === */
.main-content-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.main-content-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.theme--dark .main-content-card {
  background-color: #1e1e1e;
}

.theme--light .main-content-card {
  background-color: #ffffff;
}

/* === MAIN HEADER === */
.main-header {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
}

.theme--dark .main-header {
  background-color: #262626;
  border-bottom-color: rgba(255, 255, 255, 0.1);
}

.theme--light .main-header {
  background-color: #f8fafc;
  border-bottom-color: rgba(0, 0, 0, 0.06);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  width: 100%;
}

.header-info {
  flex: 1;
}

.decompiler-title {
  display: flex;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
}

/* Back/forward history arrows */
.nav-arrow {
  opacity: 0.9;
}
.nav-arrow:disabled,
.nav-arrow.v-btn--disabled {
  opacity: 0.3;
}

.theme--dark .decompiler-title {
  color: #ffffff;
}

.theme--light .decompiler-title {
  color: #111827;
}

.address-info {
  margin-bottom: 8px;
}

.address-display {
  display: flex;
  align-items: center;
  gap: 8px;
}

.label {
  font-size: 12px;
  font-weight: 500;
  min-width: 90px;
}

.theme--dark .label {
  color: rgba(255, 255, 255, 0.7);
}

.theme--light .label {
  color: rgba(0, 0, 0, 0.6);
}

.address-value {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid transparent;
}

.address-value.static {
  background-color: rgba(139, 92, 246, 0.1);
  border-color: rgba(139, 92, 246, 0.2);
}

.theme--dark .address-value.static {
  color: #a78bfa;
  background-color: rgba(139, 92, 246, 0.15);
}

.theme--light .address-value.static {
  color: #1e40af;
  background-color: rgba(30, 64, 175, 0.1);
  border-color: rgba(30, 64, 175, 0.2);
  font-weight: 700;
}

.address-value.dynamic {
  background-color: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.2);
}

.theme--dark .address-value.dynamic {
  color: #34d399;
  background-color: rgba(16, 185, 129, 0.15);
}

.theme--light .address-value.dynamic {
  color: #166534;
  background-color: rgba(22, 101, 52, 0.1);
  border-color: rgba(22, 101, 52, 0.2);
  font-weight: 700;
}

.method-info {
  margin-top: 8px;
}

.method-chip {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 11px;
  font-weight: 500;
}

/* === HEADER CONTROLS === */
.header-controls {
  flex-shrink: 0;
}

.controls-section {
  display: flex;
  align-items: center;
  gap: 16px;
}

.font-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.font-size-chip {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 11px;
  font-weight: 600;
}

.theme--dark .font-size-chip {
  background-color: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.9);
  border-color: rgba(255, 255, 255, 0.2);
}

.theme--light .font-size-chip {
  background-color: rgba(0, 0, 0, 0.04);
  color: rgba(0, 0, 0, 0.8);
  border-color: rgba(0, 0, 0, 0.15);
}

.font-size-controls {
  background: none;
}

.rebase-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rebase-chip {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 10px;
  font-weight: 600;
}

.rebase-btn, .clear-rebase-btn {
  font-size: 12px;
  font-weight: 500;
}

/* === MAIN CONTENT === */
.main-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  overflow-x: hidden;
  --base-font-size: 12px;
  --dynamic-font-size: var(--base-font-size);
}

.theme--dark .main-content {
  background-color: #1e1e1e;
  color: #ffffff;
}

.theme--light .main-content {
  background-color: #ffffff;
  color: #000000;
}

/* === IMPROVED DISASSEMBLY STYLING === */
.basic-block-wrapper {
  margin-bottom: 24px;
  border-left: 3px solid #6366f1;
  padding: 0;
  border-radius: 0 8px 8px 0;
  overflow: hidden;
}

.theme--dark .basic-block-wrapper {
  background-color: rgba(99, 102, 241, 0.03);
  border-left: 3px solid #6366f1;
  /* Remove all other borders in dark mode */
}

.theme--light .basic-block-wrapper {
  background-color: rgba(99, 102, 241, 0.02);
  border: 1px solid rgba(99, 102, 241, 0.08);
  border-left: 3px solid #6366f1;
}

.basic-block-header {
  font-weight: 600;
  margin-bottom: 0;
  font-size: calc(var(--dynamic-font-size, 12px) + 2px);
  padding: 12px 16px;
  border-bottom: 1px solid rgba(99, 102, 241, 0.15);
}

.theme--dark .basic-block-header {
  color: #818cf8;
  background-color: rgba(99, 102, 241, 0.08);
}

.theme--light .basic-block-header {
  color: #1e40af;
  font-weight: 700;
  background-color: rgba(99, 102, 241, 0.05);
}

.block-instructions {
  margin: 0;
  padding: 0;
}

/* === INSTRUCTION TABLE LAYOUT === */
.instruction-table {
  width: 100%;
  font-family: var(--code-font);
  font-feature-settings: "liga" 0, "calt" 0; /* literal -> == != in asm */
  font-variant-ligatures: none;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  font-size: var(--dynamic-font-size, 12px);
}

/* ── Pseudocode view ─────────────────────────────────────────────────────── */
.pseudocode-pane { width: 100%; }
.pseudocode-code {
  margin: 0;
  padding: 16px 18px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: calc(var(--dynamic-font-size, 12px) * 1.05);
  line-height: 1.55;
  white-space: pre;
  overflow-x: auto;
  border-radius: 8px;
  tab-size: 4;
}
.theme--dark.pseudocode-code {
  background-color: #1a1a1a;
  color: #d4d4d4;
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.theme--light.pseudocode-code {
  background-color: #fafafa;
  color: #1f2937;
  border: 1px solid rgba(0, 0, 0, 0.08);
}
.pseudo-error { color: #ef4444; font-size: 13px; }
.pseudo-note { opacity: 0.6; font-size: 11px; }
.view-toggle { align-self: center; }

.instruction-header {
  display: grid;
  gap: 16px;
  padding: 10px 12px;
  font-weight: 600;
  font-size: calc(var(--dynamic-font-size, 12px) * 0.9);
  border-bottom: 2px solid rgba(0, 0, 0, 0.1);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  align-items: center;
}

.theme--dark .instruction-header {
  border-bottom: 2px solid rgba(255, 255, 255, 0.1);
}

/* Simple working grid layout */
.instruction-header,
.instruction-row {
  grid-template-columns: 120px 1fr 1fr;
}

/* Grid layout with rebase */
.instruction-table.has-rebase .instruction-header,
.instruction-table.has-rebase .instruction-row {
  grid-template-columns: 120px 120px 1fr 1fr;
}

.theme--dark .instruction-header {
  background-color: rgba(0, 0, 0, 0.3);
  color: rgba(255, 255, 255, 0.9);
  border-bottom-color: rgba(255, 255, 255, 0.15);
}

.theme--light .instruction-header {
  background-color: rgba(0, 0, 0, 0.04);
  color: rgba(0, 0, 0, 0.8);
  border-bottom-color: rgba(0, 0, 0, 0.12);
}

.instruction-row {
  display: grid;
  gap: 16px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  transition: background-color 0.15s;
  min-height: 32px;
  align-items: center;
}

.theme--dark .instruction-row {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.instruction-row:hover {
  background-color: rgba(99, 102, 241, 0.05);
}

.theme--dark .instruction-row {
  border-bottom-color: rgba(255, 255, 255, 0.05);
}

.theme--dark .instruction-row:hover {
  background-color: rgba(99, 102, 241, 0.08);
}

/* "You are here" — the instruction we scrolled to after an intra-function jump */
.instruction-row--current {
  background-color: rgba(99, 102, 241, 0.16) !important;
  border-left: 3px solid #6366f1;
  animation: instr-flash 0.9s ease-out 1;
}
.theme--dark .instruction-row--current {
  background-color: rgba(99, 102, 241, 0.24) !important;
}
@keyframes instr-flash {
  0% { background-color: rgba(99, 102, 241, 0.45); }
  100% { background-color: rgba(99, 102, 241, 0.16); }
}

.theme--light .instruction-row:hover {
  background-color: rgba(99, 102, 241, 0.03);
}

/* === COLUMN STYLING === */
.col-address,
.col-dynamic {
  display: flex;
  align-items: center;
}

.col-instruction {
  display: flex;
  align-items: center;
  padding: 4px 0;
  /* Remove all padding that might create visual boxes */
}

.instruction-text {
  font-family: var(--code-font);
  font-size: var(--dynamic-font-size, 12px);
  white-space: nowrap;
  /* Ensure no background or borders are applied */
  background: none !important;
  border: none !important;
  box-shadow: none !important;
}

.col-comment {
  display: flex;
  align-items: center;
  min-height: 24px;
  padding: 2px 4px;
  word-wrap: break-word;
  overflow-wrap: break-word;
  max-width: 300px;
}

.address-code {
  font-weight: 600;
  font-size: calc(var(--dynamic-font-size, 12px) * 0.95);
  display: inline-block;
  min-width: 80px;
  text-align: left;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
  padding: 0 !important;
}

.theme--dark .address-code {
  color: #a78bfa;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
}

.theme--light .address-code {
  color: #1e40af;
  font-weight: 700;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
}

.address-code.dynamic {
  font-size: calc(var(--dynamic-font-size, 12px) * 0.9);
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
}

.theme--dark .address-code.dynamic {
  color: #34d399;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
}

.theme--light .address-code.dynamic {
  color: #166534;
  font-weight: 600;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
}

/* === ADDRESS COLUMN COMPREHENSIVE FIXES === */
.col-address *,
.col-address code,
.col-dynamic *,
.col-dynamic code {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
}

.theme--dark .col-address *,
.theme--dark .col-address code,
.theme--dark .col-dynamic *,
.theme--dark .col-dynamic code {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
}

.theme--light .col-address *,
.theme--light .col-address code,
.theme--light .col-dynamic *,
.theme--light .col-dynamic code {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
}

/* Bytes column removed for cleaner layout */

.mnemonic-text {
  font-weight: 600;
  margin-right: 12px;
  display: inline;
  min-width: 60px;
  /* Remove any borders or backgrounds */
  background: none !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
}

.theme--dark .mnemonic-text {
  color: #fbbf24;
}

.theme--light .mnemonic-text {
  color: #dc2626;
  font-weight: 700;
}

.operands-text {
  font-weight: 500;
  /* Remove any borders or backgrounds */
  background: none !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
}

.theme--dark .operands-text {
  color: #10b981;
}

.theme--light .operands-text {
  color: #059669;
  font-weight: 500;
}

/* Dark-mode instruction tokens: the theme class sits on the token element ITSELF
   (class="mnemonic-text theme--dark"), not only an ancestor, so target it as a
   COMPOUND selector and force it with !important — otherwise a global code/span
   color (or the base rule) can win and render the text dark-on-dark. Brighter
   values chosen for strong contrast on the dark slate background. */
.mnemonic-text.theme--dark { color: #fbbf24 !important; }   /* amber */
.operands-text.theme--dark { color: #6ee7b7 !important; }   /* light emerald */
.address-code.theme--dark { color: #c4b5fd !important; }    /* light violet */
.address-code.theme--dark.dynamic { color: #6ee7b7 !important; }
.instruction-row .theme--dark.operand-link { color: #93c5fd !important; }

/* Clickable branch/call targets (operand address + comment-column branch) */
.operand-link {
  cursor: pointer;
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 2px;
  transition: filter 0.12s ease;
}
.operand-link:hover {
  text-decoration-style: solid;
  filter: brightness(1.25);
}
.comment-link {
  cursor: pointer;
  border-radius: 3px;
  padding: 0 3px;
  transition: background-color 0.12s ease;
}
.comment-link:hover {
  background-color: rgba(99, 102, 241, 0.15);
  text-decoration: underline;
}

/* Resolved Obj-C message send (via __objc_stubs) — click to list xrefs. */
.msgsend-annotation {
  cursor: pointer;
  border-radius: 3px;
  padding: 0 3px;
  transition: background-color 0.12s ease;
}
.msgsend-annotation:hover {
  background-color: rgba(16, 185, 129, 0.16);
  text-decoration: underline;
}
.theme--dark .msgsend-annotation { color: #34d399; }
.theme--light .msgsend-annotation { color: #059669; }

/* External import call (resolved in the dyld shared cache) — a non-clickable
   badge, visually distinct from navigable local branches. */
.external-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 6px;
  border-radius: 10px;
  cursor: help;
  font-style: normal;
  border: 1px solid rgba(148, 163, 184, 0.35);
}
.external-badge-icon { opacity: 0.7; }
.external-badge-symbol { font-weight: 500; }
.external-badge-tag {
  font-size: 0.7em;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0 4px;
  border-radius: 6px;
  opacity: 0.9;
}
.theme--dark .external-badge {
  background-color: rgba(148, 163, 184, 0.1);
  color: #cbd5e1;
}
.theme--dark .external-badge-tag {
  background-color: rgba(148, 163, 184, 0.22);
  color: #e2e8f0;
}
.theme--light .external-badge {
  background-color: rgba(100, 116, 139, 0.08);
  color: #475569;
}
.theme--light .external-badge-tag {
  background-color: rgba(100, 116, 139, 0.18);
  color: #334155;
}

.comment-text {
  font-style: italic;
  font-size: calc(var(--dynamic-font-size, 12px) * 0.9);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  line-height: 1.3;
  word-break: break-word;
  overflow-wrap: break-word;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
  padding: 0 !important;
}

.theme--dark .comment-text {
  color: #d1d5db;
  opacity: 0.9;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
}

.theme--light .comment-text {
  color: #4b5563;
  font-weight: 500;
  opacity: 0.95;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
}

.dynamic-comment {
  opacity: 0.7;
  margin-left: 4px;
  font-size: calc(var(--dynamic-font-size, 12px) * 0.8);
}

.theme--dark .dynamic-comment {
  color: #34d399;
}

.theme--light .dynamic-comment {
  color: #166534;
}

/* === ICON VISIBILITY FIXES === */
.theme--dark .v-icon {
  color: rgba(255, 255, 255, 0.8) !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

.theme--light .v-icon {
  color: rgba(0, 0, 0, 0.7) !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

.comment-text .v-icon {
  opacity: 0.8;
  margin-right: 4px !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

.theme--dark .comment-text .v-icon {
  color: #9ca3af !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

.theme--light .comment-text .v-icon {
  color: #6b7280 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

/* === DECOMPILER SECTION ICON FIXES === */
.disassembly-container .v-icon,
.instruction-row .v-icon,
.comment-text .v-icon,
.basic-block-wrapper .v-icon {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
}

.theme--dark .disassembly-container .v-icon,
.theme--dark .instruction-row .v-icon,
.theme--dark .basic-block-wrapper .v-icon {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
}

.theme--light .disassembly-container .v-icon,
.theme--light .instruction-row .v-icon,
.theme--light .basic-block-wrapper .v-icon {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
}

/* === COMPREHENSIVE COMMENT STYLING FIXES === */
.comment-text *,
.comment-text span,
.comment-text template,
.col-comment *,
.col-comment span {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
  padding: 0 !important;
  margin: 0 !important;
}

.theme--dark .comment-text *,
.theme--dark .comment-text span,
.theme--dark .col-comment *,
.theme--dark .col-comment span {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
}

.theme--light .comment-text *,
.theme--light .comment-text span,
.theme--light .col-comment *,
.theme--light .col-comment span {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
}

.block-connections {
  margin: 12px 16px 0 16px;
  padding: 8px 12px;
  font-weight: 500;
  font-size: calc(var(--dynamic-font-size, 12px) * 0.9);
  border-radius: 4px;
  border-left: 3px solid;
}

.theme--dark .block-connections {
  color: #34d399;
  background-color: rgba(52, 211, 153, 0.08);
  border-left-color: #34d399;
}

.theme--light .block-connections {
  color: #166534;
  font-weight: 600;
  background-color: rgba(22, 101, 52, 0.05);
  border-left-color: #166534;
}

/* === ERROR STYLING === */
.error-message {
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 500;
}

.theme--dark .error-message {
  background-color: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.theme--light .error-message {
  background-color: rgba(239, 68, 68, 0.1);
  color: #dc2626;
  border: 1px solid rgba(239, 68, 68, 0.15);
}

/* === ENHANCED GRAPH CONTAINER === */
.graph-container {
  min-height: 600px;
  border-radius: 12px;
  overflow: visible;
  margin-top: 30px;
  padding: 20px;
  position: relative;
}

.theme--dark .graph-container {
  border: 2px solid rgba(99, 102, 241, 0.2);
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.theme--light .graph-container {
  border: 2px solid rgba(99, 102, 241, 0.15);
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

/* Graph Header */
.graph-header {
  position: absolute;
  top: 15px;
  left: 20px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(0, 0, 0, 0.8);
  padding: 8px 16px;
  border-radius: 20px;
  backdrop-filter: blur(10px);
}

.theme--dark .graph-header {
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.theme--light .graph-header {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.graph-title {
  font-weight: 600;
  font-size: 14px;
  color: white;
}

.theme--light .graph-title {
  color: #1e293b;
}

/* Graph Controls */
.graph-controls {
  position: absolute;
  top: 15px;
  right: 20px;
  z-index: 10;
  display: flex;
  gap: 8px;
}

.graph-control-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.theme--dark .graph-control-btn {
  background: rgba(99, 102, 241, 0.2);
  border: 1px solid rgba(99, 102, 241, 0.3);
  color: #a78bfa;
}

.theme--light .graph-control-btn {
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.2);
  color: #6366f1;
}

.graph-control-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

/* SVG Styling */
.cfg-svg {
  width: 100%;
  height: 100%;
  min-height: 500px;
}

/* Node Styling */
:global(.cfg-svg .node rect) {
  rx: 8px;
  ry: 8px;
  stroke-width: 2px;
}

:global(.theme--dark .cfg-svg .node rect) {
  fill: #1e293b;
  stroke: #6366f1;
}

:global(.theme--light .cfg-svg .node rect) {
  fill: #ffffff;
  stroke: #6366f1;
}

:global(.cfg-svg .node text) {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 11px;
  dominant-baseline: central;
}

:global(.theme--dark .cfg-svg .node text) {
  fill: #e2e8f0;
}

:global(.theme--light .cfg-svg .node text) {
  fill: #1e293b;
}

/* Edge Styling */
:global(.cfg-svg .edgePath path) {
  stroke-width: 2px;
  fill: none;
}

:global(.theme--dark .cfg-svg .edgePath path) {
  stroke: #6366f1;
}

:global(.theme--light .cfg-svg .edgePath path) {
  stroke: #6366f1;
}

/* Conditional edge styling */
:global(.cfg-svg .edgePath.conditional path) {
  stroke-dasharray: 5,5;
  stroke: #f59e0b;
}

/* Edge labels */
:global(.cfg-svg .edgeLabel) {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 10px;
  font-weight: 600;
}

:global(.theme--dark .cfg-svg .edgeLabel) {
  fill: #fbbf24;
}

:global(.theme--light .cfg-svg .edgeLabel) {
  fill: #d97706;
}

/* Graph Legend */
.graph-legend {
  position: absolute;
  bottom: 15px;
  left: 20px;
  display: flex;
  gap: 16px;
  font-size: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 4px;
}

.theme--dark .legend-item {
  background: rgba(0, 0, 0, 0.4);
  color: #e2e8f0;
}

.theme--light .legend-item {
  background: rgba(255, 255, 255, 0.8);
  color: #1e293b;
}

.legend-line {
  width: 16px;
  height: 2px;
  border-radius: 1px;
}

.legend-line.unconditional {
  background: #6366f1;
}

.legend-line.conditional {
  background: #f59e0b;
  background-image: repeating-linear-gradient(
    90deg,
    transparent,
    transparent 3px,
    rgba(0,0,0,0.3) 3px,
    rgba(0,0,0,0.3) 6px
  );
}

/* === REBASE DIALOG MODERN STYLING === */
.modern-card {
  border-radius: 12px !important;
  overflow: hidden;
}

.rebase-content {
  max-width: 100%;
}

.rebase-alert {
  border-radius: 8px;
}

.alert-content h4 {
  font-weight: 600;
  font-size: 14px;
}

.setup-step {
  font-size: 13px;
  line-height: 1.5;
}

.code-block {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 11px;
  padding: 12px;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  line-height: 1.4;
}

.theme--dark .code-block {
  background-color: #0f172a;
  border-color: rgba(255, 255, 255, 0.1);
  color: #34d399;
}

.theme--light .code-block {
  background-color: #f1f5f9;
  border-color: rgba(0, 0, 0, 0.08);
  color: #059669;
}

.input-section {
  margin-bottom: 16px;
}

.rebase-input {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}

.theme--dark .rebase-input {
  --v-field-bg: #2d2d2d;
  --v-theme-surface: #2d2d2d;
}

.theme--light .rebase-input {
  --v-field-bg: #ffffff;
  --v-theme-surface: #ffffff;
}

.calculation-results {
  margin-top: 20px;
}

.calculation-alert {
  border-radius: 8px;
}

.calculation-content h4 {
  font-weight: 600;
  font-size: 14px;
  color: #059669;
}

.theme--dark .calculation-content h4 {
  color: #34d399;
}

.formula-display {
  display: flex;
  align-items: center;
  gap: 12px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  justify-content: center;
  padding: 12px;
  border-radius: 6px;
}

.theme--dark .formula-display {
  background-color: rgba(0, 0, 0, 0.2);
}

.theme--light .formula-display {
  background-color: rgba(0, 0, 0, 0.02);
}

.address-value {
  color: #8b5cf6;
  font-weight: 600;
}

.theme--dark .address-value {
  color: #a78bfa;
}

.operator {
  font-weight: bold;
  font-size: 16px;
}

.theme--dark .operator {
  color: #ffffff;
}

.theme--light .operator {
  color: #000000;
}

.result-value {
  color: #059669;
  font-weight: 700;
  font-size: 14px;
}

.theme--dark .result-value {
  color: #34d399;
}

.transformation-display {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
}

.static-addr {
  color: #8b5cf6;
  font-weight: 600;
}

.theme--dark .static-addr {
  color: #a78bfa;
}

.dynamic-addr {
  color: #059669;
  font-weight: 600;
}

.theme--dark .dynamic-addr {
  color: #34d399;
}

.modern-actions {
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.theme--dark .modern-actions {
  background-color: #262626;
  border-top-color: rgba(255, 255, 255, 0.1);
}

.theme--light .modern-actions {
  background-color: #f8fafc;
}

/* Crypto static-key styles moved to components/iOS/CryptoPanel.vue */
</style>
