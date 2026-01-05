## Revised Product Plan: Recipe Snap

**Recipe Snap** is a lightweight, privacy-focused single-page application (SPA) designed to bridge the gap between physical media (cookbooks, handwritten notes) and the Paprika Recipe Manager. By using **Gemini 3 Flash** on the client side, the app automates the tedious task of data entry without requiring a dedicated backend.

---

### 1. High-Level Workflow

1. **Authentication:** User inputs their Google Gemini API Key (stored locally).
2. **Capture:** User uploads or snaps photos of recipe pages.
3. **Local Processing:** * HEIC files are converted to JPEG.
* Images are resized/downscaled to optimize performance and cost.
* Images are converted to Base64 strings.


4. **AI Extraction:** The browser sends the images to Gemini 3 Flash with a structured prompt.
5. **Assembly:** The app merges the AI-extracted text with the local Base64 images into a `.paprikarecipe` (JSON) file.
6. **Review & Export:** The user edits the JSON in a text area and downloads the final file.

---

### 2. Technical Specifications

#### Frontend Architecture

* **Format:** Single HTML file (including CSS and JS).
* **Libraries (CDN):**
* `Google Generative AI SDK`: To communicate with Gemini 3 Flash.
* `heic2any`: To handle iPhone photo compatibility.


* **Storage:** `window.localStorage` for persistent API Key storage.

#### Image Processing Pipeline

* **Resizing Logic:** Images will be processed via a hidden `<canvas>` to a maximum dimension of **1600px** (width or height). This ensures the prompt stays within the model's token limits while maintaining enough detail for OCR.
* **Base64 Handling:** The app will maintain an array of the original (resized) Base64 strings to inject into the final JSON, ensuring the "photos" field is populated correctly.

#### AI Prompt Strategy

* **Model:** Gemini 3 Flash.
* **Output Format:** Strict JSON.
* **Instructions:**
* Extract: `name`, `ingredients` (formatted as a single string with newlines), `directions` (as an array of strings), `servings`, `prep_time`, and `cook_time`.
* Exclude: The model will be told **not** to return the images in its response to save bandwidth; the app will merge the local Base64 strings into the final JSON object.



---

### 3. Feature Breakdown

| Feature | Description |
| --- | --- |
| **Direct Camera Access** | Mobile users can trigger the camera directly from the "Upload" button. |
| **HEIC Support** | Automatically handles `.heic` files, converting them to `.jpg` transparently. |
| **Live Editor** | A `textarea` populated with the raw `.paprikarecipe` JSON, allowing users to fix typos before saving. |
| **One-Click Export** | Buttons to "Copy to Clipboard" or "Download" with the `.paprikarecipe` extension. |
| **Privacy First** | No images or API keys are ever sent to a third-party server (other than Google). |

---

### 4. User Interface (UI) Design

* **Clean & Minimal:** A card-based layout with a "Settings" gear for the API Key.
* **Visual Feedback:** Thumbnail previews of uploaded images so users can verify the order before processing.
* **Status Indicators:** Clear loading states ("Converting HEIC...", "Optimizing Images...", "Gemini is reading...").

---

### 5. Data Schema Example

The final output in the textbox will follow this structure:

```json
{
  "name": "Grandma's Famous Lasagna",
  "ingredients": "1 lb Ground Beef\n2 cups Mozzarella...",
  "directions": [
    "Brown the beef in a large skillet.",
    "Layer noodles and cheese in a baking dish."
  ],
  "servings": "8",
  "photos": ["data:image/jpeg;base64,...", "data:image/jpeg;base64,..."]
}

```

---

**Would you like me to generate the full HTML, CSS, and JavaScript code for Recipe Snap now?**