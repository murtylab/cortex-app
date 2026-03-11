"""Gemini LLM client for open-ended questions. Requires GEMINI_API_KEY."""
from __future__ import annotations

import os


def get_gemini_reply(user_message: str, rule_context: str | None = None, page_context: str | None = None) -> str | None:
    """
    Call Gemini to answer the user message in the context of Virtual Visual Cortex.
    Returns the model reply text, or None if the API key is missing or the call fails.
    """
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key or not api_key.strip():
        print("[gemini] ERROR: No API key found in environment (GEMINI_API_KEY / GOOGLE_API_KEY)")
        return None

    try:
        try:
            from google import genai
        except ImportError:
            raise ImportError("The 'google-genai' library is not installed. Run: pip install google-genai")
        model_id = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
        print(f"[gemini] using key: {api_key[:8]}... model: {model_id}")
        client = genai.Client(api_key=api_key.strip())
        # Build page context prefix so Gemini knows where the user is
        page_ctx_str = ""
        if page_context:
            if page_context.startswith("model_page:"):
                model_name = page_context.split(":", 1)[1].replace("_", " ")
                page_ctx_str = (
                    f"=== USER'S CURRENT PAGE ===\n"
                    f"The user is on the model detail page for: {model_name}. "
                    f"When they say 'this model' they mean {model_name}.\n\n"
                )
            elif page_context.startswith("scoreboard"):
                # Parse rich scoreboard state: "scoreboard|training:NSD|region:PPA|selected_model:resnet50|..."
                parts = dict(p.split(":", 1) for p in page_context.split("|") if ":" in p)
                ctx_lines = ["The user is on the Scoreboard page."]
                if parts.get("training"):
                    ctx_lines.append(f"Current training filter: {parts['training']}.")
                if parts.get("region"):
                    ctx_lines.append(f"Selected brain region(s): {parts['region']}.")
                if parts.get("dataset"):
                    ctx_lines.append(f"Selected dataset(s): {parts['dataset']}.")
                if parts.get("selected_model"):
                    model = parts["selected_model"].replace("_", " ")
                    ctx_lines.append(f"The user has selected / is looking at the model: {model}. When they say 'this model' they mean {model}.")
                if parts.get("chart"):
                    ctx_lines.append(f"Chart type: {'univariate' if parts['chart'] == 'uni' else 'multivariate'}.")
                if parts.get("view") == "2":
                    ctx_lines.append("The user is in the Advanced Insights view.")
                page_ctx_str = "=== USER'S CURRENT PAGE ===\n" + " ".join(ctx_lines) + "\n\n"
            elif page_context == "lab":
                page_ctx_str = "=== USER'S CURRENT PAGE ===\nThe user is on the Lab page.\n\n"

        prompt = (
            "You are the friendly assistant for Virtual Visual Cortex, a platform that bridges neuroscience and AI. "
            "Answer any question about the platform clearly and conversationally.\n\n"
            + page_ctx_str
            + "=== PLATFORM OVERVIEW ===\n"
            "Three main sections:\n"
            "1. Home — introduction and overview.\n"
            "2. The Lab — upload images, pick an AI vision model + training dataset (NSD or Murty185), "
            "select brain regions (FFA, PPA, EBA), and get predicted neural responses. "
            "Steps: upload images → select model → select training dataset → choose brain regions → run predictions.\n"
            "3. The Scoreboard — ranks AI models by how well they predict actual brain fMRI activity. "
            "Filter by training dataset, brain region, evaluation dataset to compare models.\n\n"
            "=== BRAIN REGIONS (ROIs) ===\n"
            "FFA (Fusiform Face Area) — face processing. "
            "PPA (Parahippocampal Place Area) — scene/spatial processing. "
            "EBA (Extrastriate Body Area) — body/body-part processing.\n\n"
            "=== TRAINING DATASETS ===\n"
            "NSD — 1,000 natural scene images, fMRI from 8 subjects (Allen et al., 2022). "
            "Murty185 — 185 naturalistic stimuli, 20+ repetitions, 4 participants in functionally-defined ROIs (Murty et al., 2021).\n\n"
            "=== EVALUATION DATASETS ===\n"
            "BOLD5000 (5,254 images, 4 subjects), Bonner2021 (810 objects, 81 categories), "
            "BMD2024 (1,102 video clips, challenging), KingBaker2019 (diverse cognitive tasks), "
            "Wardle2020 (face pareidolia stimuli), NSD Synthetic (284 controlled out-of-distribution images).\n\n"
            "=== METHODOLOGY ===\n"
            "Model activations extracted → ridge regression maps activations to voxel responses → "
            "performance = Pearson correlation (predicted vs actual fMRI). "
            "Univariate = per-voxel prediction; multivariate = joint pattern across voxels. "
            "Global score = mean across all eval datasets (excluding NSD/Murty185 training sets), "
            "first averaged per-dataset across PPA/FFA/EBA, then averaged across datasets. "
            "Scores above ~0.4 are strong; 0.01–0.02 differences are meaningful. "
            "Ceiling = max possible score given measurement reliability.\n\n"
            "=== KEY MODELS ===\n"
            "Vision-language: BLIP2, CLIP (RN50/RN101/ViT-B32), Kosmos2, SigLIP, SigLIP2, AIMv2, Nomic. "
            "Self-supervised transformers: DINOv2 (base/large), BEiT, EVA-02, WebSSL-DINO300M, WebSSL-MAE300M. "
            "CNNs: ResNet, WideResNet, ConvNeXt, EfficientNet, DenseNet, VGG, AlexNet, BiT, Inception, Xception, HRNet, MobileNetV2. "
            "Brain-optimized: CORnet (S/RT/Z), TDANN, TopoNets, VOneNet variants. "
            "Task-trained: Taskonomy (depth, edges, segmentation, colorization, etc.). "
            "Baselines: random-weight variants; adversarially robust variants (epsilon parameter).\n\n"
            "STYLE:\n"
            "• Match answer length to the question — short questions get short answers.\n"
            "• No long bullet lists unless the user explicitly asks for a list.\n"
            "• For greetings or 'what can you do', give a 2–3 sentence friendly summary.\n"
            "• For 'why' or conceptual questions, give a 2–4 sentence explanation.\n"
            "• Off-topic (not about this platform): say exactly: "
            "I'm here to help with Virtual Visual Cortex! Ask me about the Lab, Scoreboard, "
            "brain regions (FFA, PPA, EBA), or models like BLIP2 or DINOv2.\n"
            "• NEVER use markdown symbols like * or ** for bullets or bold. "
            "Write in plain prose. If a list is truly needed, use a numbered format like '1) ... 2) ...' "
            "or write it as flowing sentences.\n\n"
            + (
                "SCOREBOARD DATA (real numbers — ground your answer in these):\n"
                + rule_context + "\n\n"
                if rule_context else ""
            )
            + "User: " + user_message
        )
        response = client.models.generate_content(model=model_id, contents=prompt)
        if response and response.text:
            return response.text.strip()
    except Exception as e:
        print(f"[gemini] ERROR: {type(e).__name__}: {e}")
    return None
