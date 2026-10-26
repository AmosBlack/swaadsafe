# 🍽️ SwaadSafe - AI Menu Allergy & Taste Advisor

A smart, multimodal dining assistant powered by **Sarvam AI** and **Computational Gastronomy** (inspired by [Foodoscope](https://www.foodoscope.com/)). 

**SwaadSafe** scans restaurant menus (from a photo or text), checks dishes against your specific allergies and dietary restrictions, uncovers **hidden regional allergens**, and recommends the safest, most appetizing meals matching your taste profile.

---

## 🌟 The Core Problem & Solution

Dining out with allergies is hazardous, particularly in Indian and complex global cuisines, because menus rarely list detailed ingredients:
- **Hidden Gluten / Wheat**: Compounded Asafoetida (*Hing*) used in tadka almost universally contains compounded maida/wheat flour as a carrier; sooji/rava in dosas; gravies thickened with maida.
- **Hidden Tree Nuts & Peanuts**: Cashew/melon-seed paste forms the creamy base of *Makhani, Korma, Shahi Paneer, and Malai Kofta*; roasted peanut powder (*shengdana*) is mixed into Maharashtrian dishes (*Misal, Sabudana Khichdi*).
- **Hidden Dairy**: Ghee used for tempering yellow dal; curd in tandoori marinades and biryani yakhni; butter brushed onto rotis.
- **Hidden Soy & Mustard**: Soy sauce in Indo-Chinese; cold-pressed mustard oil in Eastern/Bihari gravies.

**SwaadSafe** solves this by combining:
1. **Sarvam Vision / Document AI (`sarvam-vision-v1`)**: Digitizes multi-column and multilingual restaurant menus (supporting 22 Indian languages + English).
2. **Sarvam Chat Completion (`sarvam-105b-conversations`)**: Analyzes culinary recipes, estimates allergen risks (Safe / Caution / Unsafe), scores dishes against your taste profile (1–100), and creates custom kitchen modification requests.
3. **Computational Gastronomy Layer**: Maps flavor molecules and recipe taxonomies (referencing RecipeDB / FlavorDB).
4. **Bilingual Waiter Safety Card**: Generates a card in English and your local Indian language (Hindi, Tamil, Telugu, etc.) to show directly to the restaurant staff.

---

## 🚀 Quickstart

The application uses modern **Node.js (v20+)** native modules with **zero external dependencies** required for core execution.

### 1. Ensure your `.env` contains your Sarvam API Key
```env
SARVAM_API_KEY=your_sarvam_api_key_here
```

### 2. Start the Server
```bash
npm start
# or directly:
node --env-file=.env server.js
```

### 3. Open in Browser
Visit **[http://localhost:3000](http://localhost:3000)** in your browser or on your phone connected to the local network.

---

## 📂 Project Structure

```
├── server.js                   # Node.js native web server & REST API
├── services/
│   ├── sarvamService.js        # Sarvam Document AI & Chat Completion (sarvam-105b-conversations)
│   └── foodoscopeService.js    # Computational gastronomy knowledge & RecipeDB adapter
├── data/
│   └── sampleMenus.js          # Pre-loaded menus (North Indian, South Indian, Indo-Chinese)
├── public/
│   ├── index.html              # Clean, responsive web interface
│   ├── style.css               # Styling with safety status colors (Green/Amber/Red)
│   └── app.js                  # Client logic (camera upload, taste pills, waiter card)
├── .env                        # Private Sarvam API key (git-ignored)
└── package.json
```

---

## 📱 Features

- **📸 Menu Photo Capture**: Drag-and-drop or photograph a physical menu.
- **⚡ Pre-loaded Sample Menus**: One-click test with North Indian Mughlai, South Indian Udupi/Chettinad, and Indo-Chinese menus.
- **🛡️ Custom Allergen Matrix**: Select Dairy, Gluten, Peanuts, Tree nuts, Soy, Eggs, Mustard, Sesame, or type custom allergies.
- **🔥 Calorie Counting & Target Goals**: Sets calorie limits for the meal (e.g. 450, 650, 850 kcal) with portion calorie estimates and macro tags (High Protein, Low Carb, Balanced).
- **❤️ Favorite Dishes Benchmarking**: Type your favorite dishes; Sarvam matches gravies, spices, and textures to find similar menu items.
- **🍱 Intelligent Meal Combo Builder**: Assembles a complete course combination (e.g. Starter + Main) that is 100% allergen-safe and fits your calorie budget.
- **⏰ Meal of the Day & Course Filtering**: Classifies and filters by Breakfast, Lunch, Dinner, Snack, Starters, Mains, Breads & Rice, Desserts.
- **📋 Waiter Safety Card**: Generates instructions translated to the waiter's local language with a single "Copy Note" button.
# swaadsafe
