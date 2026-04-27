// Chatbot widget for Virtual Visual Cortex
// Preset questions are answered from the static knowledge base (no API call).
// All other questions are routed to /api/chat (rule-based + Gemini).

(function () {
  // ---- Page detection -------------------------------------------------
  function getPageContext() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes("model-pages") || path.includes("model_pages")) {
      // Extract model name from filename (e.g. "resnet50" from "resnet50.html")
      const match = path.match(/\/([^/]+)\.html?$/);
      const modelName = match ? match[1] : null;
      return { type: "model_page", modelName };
    }
    if (path.includes("lablanding") || path.includes("lab-page") || path.includes("lab-landing") || path.includes("lab.html")) {
      return { type: "lab", modelName: null };
    }
    if (path.includes("scoreboard")) {
      return { type: "scoreboard", modelName: null };
    }
    return { type: "home", modelName: null };
  }

  const pageContext = getPageContext();

  // ---- Suggested questions per page -----------------------------------
  const presetQuestions = {
    home: [
      "What is Virtual Visual Cortex?",
      "What can I do in the Lab?",
      "What is the Scoreboard?",
    ],
    lab: [
      "How do I upload my own stimuli?",
      "What models can I test in the Lab?",
      "Can I select specific brain regions for predictions?",
    ],
    scoreboard: [
      "Which AI models best predict brain activity across datasets?",
      "What do the performance scores mean?",
      "Which datasets are hardest to explain?",
    ],
    model_page: [
      "What is this model?",
      "How does this model perform on brain prediction?",
      "How does this model compare to others?",
    ],
  };

  // ---- Static answers for preset questions (never calls the model) ----
  const presetAnswers = {
    "What is Virtual Visual Cortex?":
      "Virtual Visual Cortex is an interactive platform that bridges neuroscience and AI. You can design experiments, test brain-aligned models, and see how well they predict neural activity. It includes a Lab for custom experiments and a Scoreboard for comparing model performance.",
    "What can I do in the Lab?":
      "The Lab is where you can upload your own images, select a model and training dataset (NSD or Murty185), and generate predicted neural responses across different brain regions like FFA, PPA, and EBA. It's perfect for running custom experiments with your own stimuli.",
    "What is the Scoreboard?":
      "The Scoreboard is a comparison tool that shows how different AI models perform across datasets, brain regions, and training sources. You can compare models trained on NSD vs Murty185, see performance across ROIs (PPA, FFA, EBA), and evaluate models on various testing datasets like BOLD5000, Bonner2021, and BMD2024.",
    "How do I upload my own stimuli?":
      "In the Lab, you can upload your own image stimuli. After uploading, select a model (like CLIP, DINOv2, BLIP2, etc.) and a training dataset (NSD or Murty185), then choose which brain regions you want predictions for. The platform will generate predicted neural responses for your images.",
    "What models can I test in the Lab?":
      "You can test many AI models in the Lab, including: BLIP2, CLIP variants (CLIP-ResNet50, CLIP-ResNet101, CLIP-ViT-B/32), DINOv2 (base and large), ConvNeXt, CORnet variants (CORnet-S, CORnet-RT, CORnet-Z), BEiT, EfficientNet, ResNet variants, VGG, Inception-v3, and many more. Each model can be tested with either NSD or Murty185 training datasets to see how well it predicts brain activity across FFA, PPA, and EBA regions.",
    "Can I select specific brain regions for predictions?":
      "Yes! In the Lab, you can select specific brain regions for predictions. Available regions include FFA (Fusiform Face Area), PPA (Parahippocampal Place Area), and EBA (Extrastriate Body Area). You can choose one or multiple regions for your experiment.",
    "Which AI models best predict brain activity across datasets?":
      "The Scoreboard is designed to answer this: it ranks models by how well they predict brain activity across multiple evaluation datasets and regions (PPA, FFA, EBA). In general, strong performers tend to include modern vision-language models (like CLIP variants and BLIP2), self-supervised transformers (like DINOv2), and brain-optimized architectures (such as TDANN and TopoNets), but you should always check the Scoreboard to see the actual rankings for your chosen training set and filters.",
    "What do the performance scores mean?":
      "The performance score shows how well a model's internal representations predict measured brain activity. The \"Global Score\" used in the Scoreboard is computed from raw (non-normalized) correlations between model activations and fMRI responses, first averaged across PPA, FFA, and EBA and then averaged across all available evaluation datasets, excluding the training datasets (Murty185 and NSD1000). Higher scores indicate stronger neural alignment, and differences of a few hundredths are meaningful.",
    "Which datasets are hardest to explain?":
      "Some evaluation datasets are harder to explain because they test more challenging or out-of-distribution conditions. For example, video-based datasets like BMD2024 and synthetic or carefully controlled image sets (such as NSD synthetic) typically yield lower scores than standard static-image datasets, revealing where models struggle to match brain activity.",

    // Brain regions
    "What is FFA?":
      "The Fusiform Face Area (FFA) is a visual brain region specialized for recognizing and processing faces. It's located in the fusiform gyrus and shows strong responses to face stimuli.",
    "What is PPA?":
      "The Parahippocampal Place Area (PPA) processes scenes, places, and large-scale spatial layouts. It's located in the parahippocampal gyrus and responds strongly to scenes and spatial environments.",
    "What is EBA?":
      "The Extrastriate Body Area (EBA) is involved in recognizing bodies and body parts. It's located in the lateral occipitotemporal cortex and shows selective responses to body-related visual stimuli.",
    "What brain regions are available?":
      "The available brain regions are: FFA (Fusiform Face Area) for face recognition, PPA (Parahippocampal Place Area) for scene and place processing, and EBA (Extrastriate Body Area) for body recognition. These are the primary visual regions of interest (ROIs) supported in the platform.",
    "What is an ROI?":
      "ROI stands for Region of Interest, which is a specific brain area studied in visual neuroscience. In this platform, the main ROIs are FFA (Fusiform Face Area) for face recognition, PPA (Parahippocampal Place Area) for scene and place processing, and EBA (Extrastriate Body Area) for body recognition.",

    // Datasets
    "What is NSD?":
      "NSD (Natural Scenes Dataset) is a subset of the Natural Scenes Dataset with fMRI measurements of 8 healthy adult subjects while they viewed 1,000 images of color natural scenes (Allen et al., 2022). It's used as a training dataset for models in Virtual Visual Cortex.",
    "What is Murty185?":
      "Murty185 is an fMRI dataset of four participants' responses in functionally-defined regions of interest (fROIs) to a diverse set of 185 naturalistic stimuli. Each of the 185 images was presented at least 20 times to each participant (Murty et al., 2021). It's used as a training dataset for models in Virtual Visual Cortex.",
    "What is BOLD5000?":
      "BOLD5000v2 is a large-scale, slow event-related fMRI dataset collected on 4 subjects, each observing 5,254 images over 15 scanning sessions. It's used as an evaluation dataset to test how well models generalize to new brain data.",
    "What is BMD2024?":
      "BMD2024 is a whole-brain fMRI dataset where participants watched 1,102 short 3-second naturalistic video clips with rich annotations (objects, scenes, actions, sentences, memorability) (Lahner et al., 2024). It's a challenging benchmark for model generalization.",
    "What is Bonner2021?":
      "Bonner2021 is an fMRI dataset where participants viewed 810 isolated objects (81 categories × 10 exemplars) on textured backgrounds. It tests object co-occurrence representations (Bonner & Epstein, 2021).",

    // Models
    "What is BLIP2?":
      "BLIP2 is a state-of-the-art vision-language model that combines computer vision and natural language processing capabilities. It can understand both images and text, making it particularly useful for tasks that require visual understanding combined with language processing. It's a Vision-Language Model type.",
    "What is CLIP?":
      "CLIP (Contrastive Language-Image Pre-training) is a vision-language model trained on large-scale image-text pairs. It learns to associate images with text descriptions. Available variants include CLIP-ResNet50, CLIP-ResNet101, and CLIP-ViT-B/32. CLIP often performs well on ROI-based brain prediction tasks.",
    "What is DINOv2?":
      "DINOv2 is a self-supervised vision transformer model trained on massive image datasets without labels. It shows strong biological alignment in visual regions and is available in base (DINOv2-B) and large (DINOv2-L) variants.",
    "What is CORnet?":
      "CORnet (Cortical Network) is a family of convolutional neural networks designed to model the primate visual cortex. Variants include CORnet-S, CORnet-RT, and CORnet-Z, each with different architectures inspired by visual neuroscience.",
    "What is TDANN?":
      "TDANN (Topographic Deep Artificial Neural Network) is a brain-optimized CNN trained to simultaneously minimize task loss and maximize topographic similarity to the primate ventral visual stream. It produces spatially organized feature maps, mirroring the layout of biological visual cortex.",
    "What is VOneNet?":
      "VOneNet is a neuro-inspired CNN that replaces the first layer with a fixed biologically-constrained V1 block (simulating primary visual cortex processing). Variants include VOne-AlexNet, VOne-CORnet-S, and VOne-ResNet50.",
    "What is ResNet?":
      "ResNet (Residual Network) is a deep convolutional neural network architecture that uses skip connections to enable training of very deep networks. Variants include ResNet50, ResNet101, and others.",
    "What is AlexNet?":
      "AlexNet is a pioneering deep convolutional neural network (Krizhevsky et al., 2012) that popularized deep learning for image recognition. It won the 2012 ImageNet competition. Random-weight variants (AlexNet Random) serve as untrained baselines.",

    // Concepts & methodology
    "What is fMRI?":
      "fMRI (functional Magnetic Resonance Imaging) measures brain activity by detecting changes in blood flow. When brain regions are active, they consume more oxygen, causing changes in the BOLD signal that fMRI detects.",
    "What is a voxel?":
      "A voxel (volume pixel) is a 3D pixel in brain imaging data. In fMRI, each voxel represents a small volume of brain tissue, typically a few cubic millimeters. Voxels contain the measured brain activity signals that models try to predict.",
    "What is brain alignment?":
      "Brain alignment refers to how well an AI model's internal representations match actual brain activity. When a model's activations correlate highly with measured neural responses, it suggests the model processes visual information similarly to the human brain.",
    "How are predictions made?":
      "Predictions are made by: 1) Running images through an AI model to get activations, 2) Training a linear mapping (ridge regression) from model activations to measured brain responses, 3) Using this mapping to predict brain activity for new images. The model learns which model features best predict each voxel's response.",
    "What is ridge regression?":
      "Ridge regression is a machine learning technique used to map model activations to brain responses. It finds the best linear combination of model features to predict each voxel's activity, with regularization to prevent overfitting and improve generalization.",
    "What is the global score?":
      "The \"Global Score\" is computed from raw (non-normalized) correlations between model activations and fMRI responses, first averaged across PPA, FFA, and EBA and then averaged across all available evaluation datasets, excluding the training datasets (Murty185 and NSD1000). Higher scores indicate stronger neural alignment.",
    "What is univariate analysis?":
      "Univariate analysis measures how well each voxel (3D pixel in brain imaging) is predicted independently. It evaluates model performance on individual brain signals, providing a voxel-by-voxel comparison between predicted and actual neural activity.",
    "What is multivariate analysis?":
      "Multivariate analysis evaluates whether a model captures the joint pattern across multiple voxels simultaneously. This is a richer test of brain alignment because it considers how well the model preserves the relationships between different brain signals, not just individual voxel predictions.",
    "What is a good score?":
      "Good scores depend on context. Raw correlations typically range from 0.3 to 0.5 for strong models. Scores above 0.4 are generally considered good, and differences of 0.01–0.02 can be meaningful. Compare to ceiling scores to see how close models are to the theoretical maximum.",
    "What is the ceiling?":
      "Ceiling represents the maximum possible performance based on measurement reliability. It accounts for noise in brain measurements and test-retest reliability. Models can't exceed the ceiling, so it shows how much of the explainable variance models capture. High ceiling means more reliable measurements.",

    // Scoreboard views
    "What is the Leaderboard?":
      "The Leaderboard is the ranking view of the Quantitative Scoreboard. It lists all AI models sorted by their performance scores, so you can quickly see which models best predict brain activity. You can filter by training dataset (NSD or Murty185), brain region (FFA, PPA, EBA), and evaluation dataset to customize the ranking.",
    "What is Advanced Insight?":
      "Advanced Insight is a deeper analysis view of the Quantitative Scoreboard. It provides scatter plots that reveal patterns beyond simple rankings — for example, comparing how close each model is to the ceiling score (gap-to-ceiling) and how models trained on NSD compare to those trained on Murty185. It's useful for understanding not just which model ranks highest, but why.",

    // Navigation & getting started
    "How do I get started?":
      "Start by exploring the Home page to learn about Virtual Visual Cortex. Then try the Scoreboard to compare model performance, or go to the Lab to run your own experiments with custom images. Use the top navigation to move between sections.",
    "How do I use the Lab?":
      "In the Lab: 1) Upload your image stimuli, 2) Select a model (CLIP, DINOv2, BLIP2, etc.), 3) Choose a training dataset (NSD or Murty185), 4) Select brain regions (FFA, PPA, EBA), 5) Generate predictions to see how the model responds to your images.",
    "How do I use the Scoreboard?":
      "On the Scoreboard page, you can: filter by training dataset (NSD or Murty185), select specific brain regions (PPA, FFA, EBA), choose evaluation datasets, and compare model performance. Use the filters and sorting options to customize your view.",
    "How do I compare models?":
      "Use the Scoreboard to compare models. Filter by training dataset, select brain regions, and choose evaluation datasets. The Scoreboard will show performance scores for each model, allowing you to see which models perform best under different conditions.",
    "Where is the Lab?":
      "Click 'The Lab' in the top navigation menu, or go to the Lab landing page to learn more. From there, click 'Try it now' to access the Lab interface where you can upload stimuli and run experiments.",
    "Where is the Scoreboard?":
      "Click 'The Scoreboard' in the top navigation menu. The Scoreboard page shows model performance comparisons across training datasets, brain regions, and evaluation datasets. You can filter and sort to explore different comparisons.",
    "What pages are available?":
      "The website has three main sections: Home (overview and introduction), The Lab (for custom experiments with your own images), and The Scoreboard (for comparing model performance). Navigate using the top menu.",
    "How can I use this for research?":
      "You can use this platform to: 1) Test hypotheses about which model features predict brain activity, 2) Compare models to find the best brain-aligned architectures, 3) Run custom experiments with your own stimuli in the Lab, 4) Evaluate model generalization across datasets and brain regions, 5) Generate predictions for new images and analyze them.",
  };

  // ---- Normalized lookup map (built once from presetAnswers) ----------
  // Allows case-insensitive and punctuation-tolerant matching of preset questions.
  function normalizeText(text) {
    return text.toLowerCase().replace(/[?!.,;:'"]/g, " ").replace(/\s+/g, " ").trim();
  }

  const normalizedAnswers = {};
  for (const [key, val] of Object.entries(presetAnswers)) {
    normalizedAnswers[normalizeText(key)] = val;
  }

  // ---- Model page links -----------------------------------------------
  // Map model display names → their model-page HTML file.
  // Order matters: more-specific / longer names must come before shorter prefixes
  // so the single-pass regex prefers them (e.g. "CLIP-RN50" before "CLIP").
  const MODEL_LINK_MAP = [
    ["WebSSL-DINO300M", "webssl_dino300m.html"],
    ["WebSSL-MAE300M",  "webssl_mae300m.html"],
    ["CLIP-ViT-B/32",   "clip_vit_b32.html"],
    ["CLIP ViT-B/32",   "clip_vit_b32.html"],
    ["CLIP-RN101",      "clip_rn101.html"],
    ["CLIP-RN50",       "clip_rn50.html"],
    ["CLIP RN101",      "clip_rn101.html"],
    ["CLIP RN50",       "clip_rn50.html"],
    ["DINOv2-large",    "dinov2_large.html"],
    ["Inception-v3",    "inceptionv3.html"],
    ["WideResNet101",   "wideresnet101.html"],
    ["WideResNet50",    "wideresnet50.html"],
    ["WideResNet",      "wideresnet50.html"],
    ["MobileNetV2",     "mobilenetv2.html"],
    ["EfficientNet",    "efficient_net.html"],
    ["CORnet-RT",       "cornet_rt.html"],
    ["CORnet-S",        "cornet_s.html"],
    ["CORnet-Z",        "cornet_z.html"],
    ["VOneAlexNet",     "vone_alexnet.html"],
    ["VOneNet",         "vone_rn50.html"],
    ["ResNet101",       "resnet101.html"],
    ["ResNet50",        "resnet50.html"],
    ["ResNet18",        "resnet18.html"],
    ["DenseNet",        "densenet121.html"],
    ["EVA-02",          "eva2.html"],
    ["DINOv2",          "dinov2.html"],
    ["SigLIP2",         "siglip2.html"],
    ["SigLIP",          "siglip.html"],
    ["AIMv2",           "aimv2.html"],
    ["Kosmos2",         "kosmos2.html"],
    ["ConvNeXt",        "convnext.html"],
    ["TDANN",           "tdann_simclr.html"],
    ["BLIP2",           "blip2.html"],
    ["TopoNets",        "toponets_rn18.html"],
    ["Taskonomy",       "taskonomy_depth_euclidean.html"],
    ["DreamSim",        "dreamsim_vitb16.html"],
    ["CrossViT",        "cross_vit.html"],
    ["AlexNet",         "alexnet.html"],
    ["VGG16",           "vgg16_imagenet1kv1.html"],
    ["VGG19",           "vgg19_imagenet1kv1.html"],
    ["BEiT",            "beit.html"],
    ["HRNet",           "hrnet.html"],
    ["Nomic",           "nomic.html"],
    ["Xception",        "xception.html"],
    ["Inception",       "inceptionv3.html"],
    ["ResNet",          "resnet50.html"],
    ["VGG",             "vgg16_imagenet1kv1.html"],
    ["CORnet",          "cornet_s.html"],
    ["CLIP",            "clip_vit_b32.html"],
    ["BiT",             "bit.html"],
  ];

  // Replace model name mentions in plain text with clickable links to their model pages.
  // Single-pass replacement using one combined regex so specific variants (e.g. CLIP-RN50)
  // are matched before their shorter prefixes (e.g. CLIP).
  function linkifyModels(text) {
    const pattern = MODEL_LINK_MAP
      .map(([name]) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");
    const re = new RegExp("(?<![a-zA-Z0-9])(" + pattern + ")(?![a-zA-Z0-9])", "gi");
    return text.replace(re, match => {
      const entry = MODEL_LINK_MAP.find(([name]) => name.toLowerCase() === match.toLowerCase());
      if (!entry) return match;
      return `<a href="/model-pages/${entry[1]}" target="_blank" rel="noopener" class="cortex-model-link">${match}</a>`;
    });
  }

  // ---- API -----------------------------------------------------------
  const API_BASE = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:8000"
    : "https://cortex-api-backend.vercel.app";

  function buildPageContextString() {
    if (pageContext.modelName) {
      return `model_page:${pageContext.modelName}`;
    }
    if (pageContext.type === "scoreboard") {
      const state = window.cortexScoreboardState;
      if (!state) return "scoreboard";
      const parts = ["scoreboard"];
      if (state.training) parts.push(`training:${state.training}`);
      if (Array.isArray(state.region) && state.region.length) parts.push(`region:${state.region.join(",")}`);
      if (Array.isArray(state.dataset) && state.dataset.length) parts.push(`dataset:${state.dataset.join(",")}`);
      if (state.selectedModel) parts.push(`selected_model:${state.selectedModel}`);
      if (state.chartType) parts.push(`chart:${state.chartType}`);
      if (state.pageView && state.pageView !== "rank") parts.push(`view:${state.pageView}`);
      return parts.join("|");
    }
    if (pageContext.type !== "home") return pageContext.type;
    return null;
  }

  async function fetchChatAnswer(userQuery) {
    const body = { message: userQuery };
    const ctx = buildPageContextString();
    if (ctx) body.page_context = ctx;
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    return data.reply || "Sorry, I couldn't generate a response.";
  }

  // ---- Offline fallback: keyword match against presetAnswers ----------
  // Used when the API is unreachable so users still get helpful answers.
  const STOP_WORDS = new Set([
    "what", "which", "where", "when", "who", "why", "how", "does", "this",
    "that", "with", "from", "into", "they", "their", "there", "about", "have",
    "will", "would", "could", "should", "the", "and", "but", "for", "not",
    "are", "was", "can", "its", "our", "you", "use", "get", "tell", "give",
    "more", "some", "any", "all", "also", "just", "than", "then", "only",
  ]);

  function findOfflineAnswer(userQuery) {
    const q = userQuery.toLowerCase().replace(/[?!.,;:'"]/g, " ").replace(/\s+/g, " ").trim();
    const qWords = q.split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
    if (qWords.length === 0) return null;

    let bestAnswer = null;
    let bestScore = 0;

    for (const [question, answer] of Object.entries(presetAnswers)) {
      const qNorm = question.toLowerCase().replace(/[?!.,;:'"]/g, " ").replace(/\s+/g, " ");
      const keywords = qNorm.split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));

      // Score = number of user words that appear in this question's keywords
      const score = qWords.filter(w => keywords.includes(w) || qNorm.includes(w)).length;
      if (score > bestScore) {
        bestScore = score;
        bestAnswer = answer;
      }
    }

    // Require at least one meaningful keyword match
    return bestScore >= 1 ? bestAnswer : null;
  }

  // Find a static answer tolerating case, punctuation, and misspellings.
  // 1) Exact match  2) Normalized match  3) High-confidence keyword match (score ≥ 2)
  function findStaticAnswer(text) {
    // 1. Exact match
    if (presetAnswers[text]) return presetAnswers[text];

    // 2. Normalized match (case-insensitive, punctuation-tolerant)
    const norm = normalizeText(text);
    if (normalizedAnswers[norm]) return normalizedAnswers[norm];

    // 3. Keyword scoring for misspellings — require ≥ 2 matching keywords
    const qWords = norm.split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
    if (qWords.length === 0) return null;
    let bestAnswer = null;
    let bestScore = 0;
    for (const [question, answer] of Object.entries(presetAnswers)) {
      const qNorm = normalizeText(question);
      const keywords = qNorm.split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
      const score = qWords.filter(w => keywords.includes(w)).length;
      if (score > bestScore) { bestScore = score; bestAnswer = answer; }
    }
    return bestScore >= 2 ? bestAnswer : null;
  }

  async function answerQuery(userQuery) {
    try {
      return await fetchChatAnswer(userQuery);
    } catch (e) {
      console.error("[chatbot] API unavailable, using offline fallback.", e);
      const offline = findOfflineAnswer(userQuery);
      if (offline) return offline;
      return (
        "I'm currently offline, but I can still answer common questions — just click one of the suggested questions above, or try asking: " +
        "\"What is FFA?\", \"What is BLIP2?\", \"How do I use the Lab?\", or \"What do the performance scores mean?\"."
      );
    }
  }

  // ---- DOM creation ----------------------------------------------------
  function createChatbot() {
    const container = document.createElement("div");
    container.id = "cortex-chatbot-container";

    container.innerHTML = `
      <div class="cortex-chatbot-header">
        <div>
          <div class="cortex-chatbot-title">Ask Cortex</div>
          <div class="cortex-chatbot-subtitle">
            Quick help for Virtual Visual Cortex
          </div>
        </div>
        <button class="cortex-chatbot-close" aria-label="Close chat">&times;</button>
      </div>

      <div class="cortex-chatbot-messages" id="cortex-chatbot-messages"></div>

      <div class="cortex-chatbot-suggestions">
        <div class="cortex-chatbot-suggestions-title">Suggested</div>
        <div class="cortex-chatbot-suggestion-list" id="cortex-chatbot-suggestion-list"></div>
      </div>

      <div class="cortex-chatbot-input-row">
        <input id="cortex-chatbot-input" type="text" placeholder="Ask something..." autocomplete="off" />
        <button id="cortex-chatbot-send-btn">Send</button>
      </div>
    `;

    document.body.appendChild(container);

    // Toggle button when minimized
    const toggleBtn = document.createElement("button");
    toggleBtn.id = "cortex-chatbot-toggle";
    toggleBtn.textContent = "Ask Cortex";
    document.body.appendChild(toggleBtn);

    const messagesEl = document.getElementById("cortex-chatbot-messages");
    const suggestionsEl = document.getElementById("cortex-chatbot-suggestion-list");
    const inputEl = document.getElementById("cortex-chatbot-input");
    const sendBtn = document.getElementById("cortex-chatbot-send-btn");
    const closeBtn = container.querySelector(".cortex-chatbot-close");
    const header = container.querySelector(".cortex-chatbot-header");

    // ---- Drag functionality -------------------------------------------
    let isDragging = false;
    let currentX, currentY, initialX, initialY;
    let xOffset = 0;
    let yOffset = 0;

    function dragStart(e) {
      if (e.target.tagName === "BUTTON" || e.target.closest("button")) return;
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;
      isDragging = true;
    }

    function dragEnd() {
      initialX = currentX;
      initialY = currentY;
      isDragging = false;
    }

    function drag(e) {
      if (!isDragging) return;
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      xOffset = currentX;
      yOffset = currentY;
      container.style.transform = `translate(${currentX}px, ${currentY}px)`;
    }

    header.addEventListener("mousedown", dragStart);
    document.addEventListener("mousemove", drag);
    document.addEventListener("mouseup", dragEnd);

    // ---- Message helpers ----------------------------------------------
    // Convert any * markdown bullets to HTML list items as a safety net
    function formatReply(text) {
      const lines = text.split("\n");
      const out = [];
      let inList = false;
      for (const line of lines) {
        const bullet = line.match(/^\s*[\*\-]\s+(.+)/);
        if (bullet) {
          if (!inList) { out.push("<ul>"); inList = true; }
          out.push(`<li>${linkifyModels(bullet[1])}</li>`);
        } else {
          if (inList) { out.push("</ul>"); inList = false; }
          out.push(linkifyModels(line));
        }
      }
      if (inList) out.push("</ul>");
      return out.join("\n");
    }

    function addMessage(text, sender) {
      const msg = document.createElement("div");
      msg.className = `cortex-chatbot-message ${sender}`;
      const formatted = sender === "bot" ? formatReply(text) : text;
      msg.innerHTML = `<div class="cortex-chatbot-bubble">${formatted}</div>`;
      messagesEl.appendChild(msg);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    // ---- Handle user query -------------------------------------------
    async function handleUserQuery(text) {
      if (!text.trim()) return;
      addMessage(text, "user");

      // Preset questions answered instantly from the static knowledge base
      const staticReply = findStaticAnswer(text.trim());
      if (staticReply) {
        addMessage(staticReply, "bot");
        return;
      }

      // Show "Thinking…" while waiting for the API
      const loadingMsg = document.createElement("div");
      loadingMsg.className = "cortex-chatbot-message bot";
      loadingMsg.innerHTML = `<div class="cortex-chatbot-bubble">Thinking…</div>`;
      messagesEl.appendChild(loadingMsg);
      messagesEl.scrollTop = messagesEl.scrollHeight;

      const reply = await answerQuery(text);
      loadingMsg.innerHTML = `<div class="cortex-chatbot-bubble">${formatReply(reply)}</div>`;
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    // ---- Initial welcome & suggestions --------------------------------
    const welcomeMsg = pageContext.type === "model_page" && pageContext.modelName
      ? `Hi! I can answer questions about the ${pageContext.modelName.replace(/_/g, " ")} model, or anything else about Cortex.`
      : "Hi! I can help you understand the Lab, Scoreboard, and visual brain regions like FFA and PPA.";
    addMessage(welcomeMsg, "bot");

    (presetQuestions[pageContext.type] || presetQuestions.home).forEach((q) => {
      const btn = document.createElement("button");
      btn.className = "cortex-chatbot-suggestion";
      btn.textContent = q;
      btn.addEventListener("click", () => {
        // Resolve "this model" to the actual model name for the API query
        let query = q;
        if (pageContext.modelName) {
          query = q.replace("this model", pageContext.modelName.replace(/_/g, " "));
        }
        handleUserQuery(query);
      });
      suggestionsEl.appendChild(btn);
    });

    // ---- Input handlers -----------------------------------------------
    sendBtn.addEventListener("click", () => {
      const text = inputEl.value;
      inputEl.value = "";
      handleUserQuery(text);
    });

    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const text = inputEl.value;
        inputEl.value = "";
        handleUserQuery(text);
      }
    });

    // ---- Open / close -------------------------------------------------
    closeBtn.addEventListener("click", () => {
      container.style.display = "none";
      toggleBtn.style.display = "inline-flex";
    });

    toggleBtn.addEventListener("click", () => {
      container.style.display = "flex";
      toggleBtn.style.display = "none";
    });

    // Default: collapsed on page load
    container.style.display = "none";
    toggleBtn.style.display = "inline-flex";
  }

  // Wait for DOM
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createChatbot);
  } else {
    createChatbot();
  }
})();
