import React, { useEffect, useMemo, useState } from "react";
import {
  METHOD_PER_SERVING,
  METHOD_PER_100G,
  getPerServing,
  validateFood,
  getLabels,
  formatServingCount,
  normalizeFood,
} from "./nutritionCalc.js";

export const FOOD = [
  { id:"egg", name:"Boiled egg", aliases:["egg","eggs","boiled egg","boiled eggs","whole egg","whole eggs"], unit:"egg", grams:50, protein:6.3, calories:78, category:"Protein" },
  { id:"paneer", name:"Paneer", aliases:["paneer","cottage cheese"], unit:"100 g", grams:100, protein:18, calories:265, category:"Protein" },
  { id:"milk", name:"Milk", aliases:["milk"], unit:"100 ml", grams:100, protein:3.3, calories:61, category:"Dairy" },
  { id:"curd", name:"Curd / plain yogurt", aliases:["curd","yogurt","dahi"], unit:"100 g", grams:100, protein:3.5, calories:61, category:"Dairy" },
  { id:"dal", name:"Cooked dal", aliases:["dal","daal","lentils"], unit:"100 g", grams:100, protein:7, calories:116, category:"Meals" },
  { id:"rice", name:"Cooked rice", aliases:["rice","cooked rice"], unit:"bowl", unitName:"bowl", sizeQuestion:"How big was the bowl?", grams:100, protein:2.7, calories:130, category:"Meals", sizes:{ small:{protein:2.7, calories:130}, medium:{protein:4, calories:195}, large:{protein:5.4, calories:260} } },
  { id:"roti", name:"Roti / chapati", aliases:["roti","rotis","chapati","chapatis"], unit:"piece", grams:40, protein:3, calories:110, category:"Meals" },
  { id:"chicken", name:"Cooked chicken breast", aliases:["chicken breast","chicken"], unit:"100 g", grams:100, protein:31, calories:165, category:"Protein" },
  { id:"chicken-curry", name:"Chicken curry", aliases:["chicken curry", "chicken masala", "curry chicken"], unit:"pc", unitName:"pc", grams:null, protein:12, calories:170, category:"Meals", sizes:{ small:{protein:8, calories:110}, medium:{protein:12, calories:170}, large:{protein:16, calories:230} } },
  { id:"mutton-curry", name:"Mutton / goat curry", aliases:["mutton curry", "mutton masala", "goat curry", "mutton"], unit:"pc", unitName:"pc", grams:null, protein:14, calories:250, category:"Meals", sizes:{ small:{protein:9, calories:160}, medium:{protein:14, calories:250}, large:{protein:18, calories:330} } },
  { id:"meat-curry", name:"Meat curry (mixed)", aliases:["meat curry", "meat masala"], unit:"pc", unitName:"pc", grams:null, protein:13, calories:230, category:"Meals", sizes:{ small:{protein:9, calories:150}, medium:{protein:13, calories:230}, large:{protein:17, calories:310} } },
  { id:"paneer-curry", name:"Paneer curry", aliases:["paneer curry", "paneer masala", "paneer gravy"], unit:"pc", unitName:"pc", grams:null, protein:8, calories:200, category:"Meals", sizes:{ small:{protein:5, calories:130}, medium:{protein:8, calories:200}, large:{protein:11, calories:270} } },
  { id:"tofu-curry", name:"Tofu curry", aliases:["tofu curry", "tofu masala", "tofu"], unit:"pc", unitName:"pc", grams:null, protein:8, calories:130, category:"Meals", sizes:{ small:{protein:5, calories:90}, medium:{protein:8, calories:130}, large:{protein:11, calories:180} } },
  { id:"soya-curry", name:"Soya chunk curry", aliases:["soya curry", "soy curry", "soya chunk curry", "soya chunks", "soya"], unit:"pc", unitName:"pc", grams:null, protein:9, calories:140, category:"Meals", sizes:{ small:{protein:6, calories:100}, medium:{protein:9, calories:140}, large:{protein:12, calories:190} } },
  { id:"oats", name:"Dry oats", aliases:["oats","oatmeal"], unit:"40 g", grams:40, protein:5.2, calories:152, category:"Breakfast" },
  { id:"banana", name:"Banana", aliases:["banana","bananas"], unit:"medium", grams:118, protein:1.3, calories:105, category:"Fruit" },
  { id:"peanut", name:"Peanuts", aliases:["peanut","peanuts","groundnuts"], unit:"30 g", grams:30, protein:7.7, calories:170, category:"Snacks" },
  { id:"bread", name:"Bread", aliases:["bread","slice bread","bread slice","bread slices"], unit:"slice", grams:30, protein:2.7, calories:80, category:"Breakfast" },
  { id:"whey", name:"Whey protein powder", aliases:["whey","protein powder"], unit:"scoop", grams:30, protein:24, calories:120, category:"Protein" },
  { id:"almond", name:"Almonds", aliases:["almond","almonds","badam"], unit:"10 g", grams:10, protein:2.1, calories:58, category:"Snacks" },
  { id:"apple", name:"Apple", aliases:["apple","apples"], unit:"medium", grams:182, protein:0.5, calories:95, category:"Fruit" },
  { id:"potato", name:"Boiled potato", aliases:["potato","potatoes","boiled potato"], unit:"100 g", grams:100, protein:1.9, calories:87, category:"Meals" },
];

const FOOD_BY_ID = Object.fromEntries(FOOD.map(f => [f.id, f]));
const SIZE_WORDS = { small:"small", sm:"small", medium:"medium", med:"medium", large:"large", lg:"large", big:"large" };

// Per-piece values for foods that vary by size; other foods use their base values.
function unitFor(food, size) {
  if (food.sizes) {
    const key = size || "medium";
    return { protein: food.sizes[key].protein, calories: food.sizes[key].calories };
  }
  return { protein: food.protein, calories: food.calories };
}

const PROFILES_KEY = "daily-fuel-profiles-v2";
const LOGS_KEY = "daily-fuel-family-logs-v2";
const DEFAULT_PROFILE = { id: "me", name: "Me", proteinGoal: 70, calorieGoal: 2000 };
const cleanProfiles = value => Array.isArray(value) && value.length ? value.filter(p => p && typeof p.id === "string" && typeof p.name === "string").map(p => ({ ...p, proteinGoal: Math.max(1, Number(p.proteinGoal) || 70), calorieGoal: Math.max(1, Number(p.calorieGoal) || 2000) })) : [DEFAULT_PROFILE];
const CUSTOM_KEY = "daily-fuel-custom-foods-v1";

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const fmt = n => Math.round(n * 10) / 10;
const keyFor = date => `daily-fuel-v1-${date}`;
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const safeRead = (key, fallback) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
};

// Turns a saved custom food into a row for the picker, with per-serving values.
function toPickerFood(custom) {
  const per = getPerServing(custom);
  return {
    id: `custom:${custom.id}`,
    name: custom.name,
    unit: custom.servingName,
    category: "Custom",
    protein: per.protein,
    calories: per.calories,
    unitName: custom.servingName,
  };
}

// Converts the form's string inputs into the record shape validateFood expects.
function formToInput(f) {
  return {
    name: f.name,
    servingName: f.servingName,
    method: f.method,
    servingWeightG: f.servingWeightG,
    proteinPerServing: f.protein,
    caloriesPerServing: f.calories,
    proteinPer100g: f.protein,
    caloriesPer100g: f.calories,
  };
}

// Builds the stored custom food, keeping only the fields its method uses.
function formToRecord(f) {
  const per100 = f.method === METHOD_PER_100G;
  return {
    name: f.name.trim(),
    servingName: f.servingName.trim(),
    method: f.method,
    servingWeightG: per100 ? Number(f.servingWeightG) : null,
    proteinPerServing: per100 ? null : Number(f.protein),
    caloriesPerServing: per100 ? null : Number(f.calories),
    proteinPer100g: per100 ? Number(f.protein) : null,
    caloriesPer100g: per100 ? Number(f.calories) : null,
  };
}

function parseChat(input) {
  const text = input.toLowerCase().replace(/,/g, " + ").replace(/\balong with\b|\bwith\b|\band\b/g, " + ");
  const parts = text.split(/\+|;|\n/).map(s => s.trim()).filter(Boolean);
  const found = [];
  const missed = [];
  for (const part of parts) {
    // Longest matching alias wins, so "chicken curry" beats "chicken".
    let best = null;
    for (const food of FOOD) {
      for (const alias of food.aliases) {
        if (part.includes(alias) && (!best || alias.length > best.alias.length)) best = { food, alias };
      }
    }
    if (!best) { missed.push(part); continue; }
    const match = best.food;
    const matchAlias = best.alias;
    const before = part.slice(0, part.indexOf(matchAlias)).trim();
    const after = part.slice(part.indexOf(matchAlias) + matchAlias.length).trim();
    const countText = (before + " " + after).replace(/\d+(?:\.\d+)?\s*(?:g|grams?|ml)\b/g, " ");
    const quantityMatch = countText.match(/(\d+(?:\.\d+)?)/);
    const quantity = quantityMatch ? Number(quantityMatch[1]) : 1;
    let multiplier = quantity;
    const gramsMatch = part.match(/(\d+(?:\.\d+)?)\s*(g|grams?|ml|milliliters?)/i);
    if (gramsMatch && ["paneer","milk","curd","dal","rice","chicken","potato","peanut","almond","oats"].includes(match.id)) {
      multiplier = Number(gramsMatch[1]) / match.grams;
    }
    const sizeWord = part.match(/\b(small|sm|medium|med|large|lg|big)\b/);
    const size = sizeWord ? SIZE_WORDS[sizeWord[1]] : null;
    const GRAM_FOODS = ["paneer","milk","curd","dal","rice","chicken","potato","peanut","almond","oats"];
    const usedGrams = !!gramsMatch && GRAM_FOODS.includes(match.id);
    const sized = !!match.sizes && !usedGrams;
    const u = sized ? (size ? unitFor(match, size) : null) : { protein: match.protein, calories: match.calories };
    found.push({
      id: newId(),
      foodId: match.id,
      baseName: match.name,
      name: sized && size ? `${match.name} (${size})` : match.name,
      quantity: fmt(multiplier),
      size: sized ? size : null,
      needsSize: sized && !size,
      protein: u ? fmt(u.protein * multiplier) : 0,
      calories: u ? Math.round(u.calories * multiplier) : 0,
      unitProtein: u ? u.protein : null,
      unitCalories: u ? u.calories : null,
      unitName: sized ? match.unitName : null,
      sizeQuestion: match.sizeQuestion || "How big were the pieces?",
      meal: "Snack", source: "chat"
    });
  }
  return { found, missed };
}

export default function App() {
  const [date, setDate] = useState(todayISO());
  const [profiles, setProfiles] = useState(() => cleanProfiles(safeRead(PROFILES_KEY, [{...DEFAULT_PROFILE, ...safeRead("daily-fuel-settings", {})}])));
  const [activeId, setActiveId] = useState(() => localStorage.getItem("daily-fuel-active-profile") || "me");
  const [logs, setLogs] = useState(() => {
    const saved = safeRead(LOGS_KEY, null);
    if (saved && typeof saved === "object" && !Array.isArray(saved)) return saved;
    const migrated = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("daily-fuel-v1-")) migrated[`me:${k.slice("daily-fuel-v1-".length)}`] = safeRead(k, []);
    }
    return migrated;
  });
  const activeProfile = profiles.find(p => p.id === activeId) || profiles[0];
  const profileId = activeProfile.id;
  const settings = activeProfile;
  const entries = logs[`${profileId}:${date}`] || [];
  const setEntries = updater => setLogs(old => {
    const key = `${profileId}:${date}`;
    const current = old[key] || [];
    return {...old, [key]: typeof updater === "function" ? updater(current) : updater};
  });
  const setSettings = updater => setProfiles(old => old.map(p => p.id === profileId ? (typeof updater === "function" ? updater(p) : updater) : p));
  const [profileForm, setProfileForm] = useState(null);
  const [customFoods, setCustomFoods] = useState(() => safeRead(CUSTOM_KEY, []).map(normalizeFood));
  const [tab, setTab] = useState("today");
  const [search, setSearch] = useState("");
  const [selectedFood, setSelectedFood] = useState("egg");
  const [quantity, setQuantity] = useState("1");
  const [addSize, setAddSize] = useState("medium");
  const [meal, setMeal] = useState("Breakfast");
  const [chat, setChat] = useState("");
  const [preview, setPreview] = useState(null);
  const [notice, setNotice] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [foodForm, setFoodForm] = useState(null);
  const [formError, setFormError] = useState("");
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editQty, setEditQty] = useState("");

  useEffect(() => { setPreview(null); setEditingEntryId(null); }, [date, profileId]);
  useEffect(() => { localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles)); }, [profiles]);
  useEffect(() => { localStorage.setItem(LOGS_KEY, JSON.stringify(logs)); }, [logs]);
  useEffect(() => { localStorage.setItem("daily-fuel-active-profile", profileId); }, [profileId]);
  useEffect(() => { localStorage.setItem(CUSTOM_KEY, JSON.stringify(customFoods)); }, [customFoods]);

  const totals = useMemo(() => entries.reduce((a,e)=>({protein:a.protein+(Number(e.protein)||0),calories:a.calories+(Number(e.calories)||0)}),{protein:0,calories:0}),[entries]);
  const allFoods = useMemo(() => [...FOOD.map(f => f.sizes ? { ...f, protein: unitFor(f, "medium").protein, calories: unitFor(f, "medium").calories } : f), ...customFoods.map(toPickerFood)], [customFoods]);
  const filteredFoods = allFoods.filter(f => f.name.toLowerCase().includes(search.toLowerCase()) || f.category.toLowerCase().includes(search.toLowerCase()));
  const chosen = allFoods.find(f=>f.id===selectedFood) || allFoods[0];

  const formValidation = foodForm ? validateFood(formToInput(foodForm)) : null;
  const formPreview = foodForm && foodForm.method === METHOD_PER_100G && !formValidation
    ? getPerServing({ method: METHOD_PER_100G, servingWeightG: Number(foodForm.servingWeightG), proteinPer100g: Number(foodForm.protein), caloriesPer100g: Number(foodForm.calories) })
    : null;
  const formLabels = getLabels(foodForm ? foodForm.method : METHOD_PER_SERVING);

  function flash(msg) { setNotice(msg); setTimeout(()=>setNotice(""),2500); }

  function addFood(food, qty, selectedMeal=meal, size=null) {
    const q = Math.max(0, Number(qty) || 0);
    if (!q) { setNotice("Enter a quantity greater than zero."); return; }
    const u = unitFor(food, size);
    const item = {
      id: newId(),
      foodId: food.id, name: food.sizes ? `${food.name} (${size || "medium"})` : food.name, quantity:q,
      protein:fmt(u.protein*q), calories:Math.round(u.calories*q),
      unitProtein: u.protein, unitCalories: u.calories,
      unitName: food.unitName || null,
      meal:selectedMeal, source:"manual"
    };
    setEntries(old=>[...old,item]); flash(`${food.name} added to your log.`);
  }
  function setPreviewSize(id, size) {
    setPreview(p => ({ ...p, found: p.found.map(e => {
      if (e.id !== id) return e;
      const u = unitFor(FOOD_BY_ID[e.foodId], size);
      return { ...e, size, name: `${e.baseName} (${size})`, needsSize: false,
        unitProtein: u.protein, unitCalories: u.calories,
        protein: fmt(u.protein * e.quantity), calories: Math.round(u.calories * e.quantity) };
    }) }));
  }
  function addPreview() {
    if (!preview?.found?.length) return;
    setEntries(old=>[...old,...preview.found.map(e=>({...e, meal}))]);
    setPreview(null); setChat(""); flash(`${preview.found.length} item(s) added.`);
  }
  function removeEntry(id) { setEntries(old=>old.filter(e=>e.id!==id)); }

  function startEditEntry(e) { setEditingEntryId(e.id); setEditQty(String(e.quantity)); }
  function saveEditEntry(e) {
    const q = Number(editQty);
    if (!Number.isFinite(q) || q <= 0) { setNotice("Enter a quantity greater than zero."); return; }
    const unitP = e.unitProtein ?? (e.quantity ? e.protein / e.quantity : 0);
    const unitC = e.unitCalories ?? (e.quantity ? e.calories / e.quantity : 0);
    setEntries(old=>old.map(x=>x.id===e.id ? {
      ...x, quantity:q, protein:fmt(unitP*q), calories:Math.round(unitC*q),
      unitProtein:unitP, unitCalories:unitC
    } : x));
    setEditingEntryId(null); flash("Entry updated.");
  }

  function startNewFood() {
    setFoodForm({ id:null, name:"", method:METHOD_PER_SERVING, servingName:"", servingWeightG:"", protein:"", calories:"" });
    setFormError("");
  }
  function editFood(food) {
    const per100 = food.method === METHOD_PER_100G;
    setFoodForm({
      id: food.id,
      name: food.name,
      method: food.method,
      servingName: food.servingName,
      servingWeightG: per100 && food.servingWeightG != null ? String(food.servingWeightG) : "",
      protein: String((per100 ? food.proteinPer100g : food.proteinPerServing) ?? ""),
      calories: String((per100 ? food.caloriesPer100g : food.caloriesPerServing) ?? ""),
    });
    setFormError("");
  }
  function updateForm(key, value) {
    setFoodForm(f => ({ ...f, [key]: value }));
    setFormError("");
  }
  function cancelFood() { setFoodForm(null); setFormError(""); }
  function saveFood() {
    const err = validateFood(formToInput(foodForm));
    if (err) { setFormError(err); return; }
    const record = formToRecord(foodForm);
    if (foodForm.id) {
      setCustomFoods(old => old.map(f => f.id === foodForm.id ? { ...record, id: foodForm.id } : f));
      flash("Food updated.");
    } else {
      setCustomFoods(old => [...old, { ...record, id: newId() }]);
      flash("Food saved.");
    }
    setFoodForm(null); setFormError("");
  }
  function deleteFood(food) {
    if (!window.confirm(`Delete "${food.name}" from your custom foods? Diary entries already logged will stay.`)) return;
    setCustomFoods(old => old.filter(f => f.id !== food.id));
    if (selectedFood === `custom:${food.id}`) setSelectedFood("egg");
    flash("Food deleted.");
  }

  function exportData() {
    const all = { version:2, exportedAt:new Date().toISOString(), profiles, logs, activeId:profileId, date, entries, customFoods };
    const blob = new Blob([JSON.stringify(all,null,2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=`daily-fuel-${date}.json`; a.click(); URL.revokeObjectURL(url);
  }
  function importData(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data=JSON.parse(reader.result);
        if (Array.isArray(data.profiles) && data.logs && typeof data.logs === "object" && !Array.isArray(data.logs)) {
          const restored = cleanProfiles(data.profiles);
          setProfiles(restored);
          setLogs(data.logs);
          setActiveId(restored.some(p => p.id === data.activeId) ? data.activeId : restored[0].id);
        } else {
          if (Array.isArray(data.entries)) setEntries(data.entries);
          if (data.settings) setSettings(s => ({...s, ...data.settings}));
        }
        if (Array.isArray(data.customFoods)) setCustomFoods(data.customFoods.map(normalizeFood));
        setNotice("Backup imported for the selected date.");
      } catch { setNotice("Could not read that backup file."); }
    };
    reader.readAsText(file); e.target.value="";
  }

  function saveProfile(e) {
    e.preventDefault();
    const name = profileForm.name.trim();
    if (!name) return;
    const next = { id: profileForm.id || newId(), name: name.slice(0, 40), proteinGoal: Math.max(1, Number(profileForm.proteinGoal) || 70), calorieGoal: Math.max(1, Number(profileForm.calorieGoal) || 2000) };
    setProfiles(old => profileForm.id ? old.map(p => p.id === next.id ? next : p) : [...old, next]);
    if (!profileForm.id) setActiveId(next.id);
    setProfileForm(null);
    flash(profileForm.id ? "Profile updated." : "Family member added.");
  }
  function deleteProfile(id) {
    if (profiles.length <= 1) return flash("Keep at least one profile.");
    if (!window.confirm("Remove this profile and its saved food logs?")) return;
    const remaining = profiles.filter(p => p.id !== id);
    setProfiles(remaining);
    setLogs(old => Object.fromEntries(Object.entries(old).filter(([key]) => !key.startsWith(`${id}:`))));
    if (profileId === id) setActiveId(remaining[0].id);
    setProfileForm(null);
  }

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#" onClick={e=>{e.preventDefault();setTab("today")}}>
        <span className="brand-mark">df</span><span>daily<span className="brand-light">fuel</span></span>
      </a>
      <div className="top-actions">
        <button className="family-top-button" onClick={()=>setTab("family")}>Family <span>↗</span></button>
        <button className="icon-button" title="Settings" onClick={()=>setShowSettings(v=>!v)}>⚙</button>
        
      </div>
    </header>

    <main>
      <section className="welcome-row">
        <div><div className="eyebrow">YOUR DAILY NUTRITION</div><h1>{activeProfile.name === "Me" ? "Your food log" : `${activeProfile.name}'s food log`}</h1><p className="subhead">A little progress, meal by meal.</p></div>
        <label className="date-pill"><span>◷</span><input aria-label="Select date" type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
      </section>

      <section className="profile-strip" aria-label="Family profiles">
        <div className="profile-strip-heading"><span>Tracking for</span><button className="text-button" onClick={()=>setTab("family")}>Manage family →</button></div>
        <div className="profile-pills">{profiles.map(p=><button key={p.id} className={`profile-pill ${profileId===p.id?"selected":""}`} onClick={()=>{setActiveId(p.id);setTab("today")}}><span className="profile-initial">{p.name.charAt(0).toUpperCase()}</span>{p.name}</button>)}<button className="profile-pill add-profile-pill" onClick={()=>{setProfileForm({name:"",proteinGoal:70,calorieGoal:2000});setTab("family")}}>＋ Add member</button></div>
      </section>

      {showSettings && <section className="settings panel">
        <div className="section-heading"><div><h2>Daily goals</h2></div><button className="text-button" onClick={()=>setShowSettings(false)}>Close ×</button></div>
        <div className="goal-inputs">
          <label>Protein goal (g)<input type="number" min="1" value={settings.proteinGoal} onChange={e=>setSettings(s=>({...s,proteinGoal:Math.max(1,Number(e.target.value)||1)}))}/></label>
          <label>Calorie goal (kcal)<input type="number" min="1" value={settings.calorieGoal} onChange={e=>setSettings(s=>({...s,calorieGoal:Math.max(1,Number(e.target.value)||1)}))}/></label>
        </div>
        <p className="muted small">Goals are personal settings, not medical advice. You can change them anytime.</p>
      </section>}

      <section className="stats-grid">
        <article className="stat-card protein-card">
          <div className="stat-top"><span className="stat-label">Protein</span></div>
          <div className="stat-number">{fmt(totals.protein)}<small> g</small></div>
          <div className="progress-track"><div className="progress-fill green-fill" style={{width:`${Math.min(100,totals.protein/settings.proteinGoal*100)}%`}}/></div>
          <div className="stat-bottom"><span>{Math.max(0,fmt(settings.proteinGoal-totals.protein))} g to go</span><strong>{Math.round(totals.protein/settings.proteinGoal*100)}% <i>of goal</i></strong></div>
        </article>
        <article className="stat-card calorie-card">
          <div className="stat-top"><span className="stat-label">Calories</span></div>
          <div className="stat-number">{Math.round(totals.calories).toLocaleString()}<small> kcal</small></div>
          <div className="progress-track"><div className="progress-fill orange-fill" style={{width:`${Math.min(100,totals.calories/settings.calorieGoal*100)}%`}}/></div>
          <div className="stat-bottom"><span>{Math.max(0,Math.round(settings.calorieGoal-totals.calories)).toLocaleString()} kcal to go</span><strong>{Math.round(totals.calories/settings.calorieGoal*100)}% <i>of goal</i></strong></div>
        </article>
      </section>

      <nav className="tabs">
        <button className={tab==="today"?"active":""} onClick={()=>setTab("today")}>Food diary</button>
        <button className={tab==="add"?"active":""} onClick={()=>setTab("add")}>Add food</button>
        <button className={tab==="foods"?"active":""} onClick={()=>setTab("foods")}>My foods</button>
        <button className={tab==="chat"?"active":""} onClick={()=>setTab("chat")}>Quick log</button>
        <button className={tab==="family"?"active":""} onClick={()=>setTab("family")}>Family</button>
      </nav>

      {tab==="today" && <section className="diary panel">
        <div className="section-heading"><div><h2>Food diary <span className="count">{entries.length} {entries.length===1?"item":"items"}</span></h2></div><button className="primary-button compact" onClick={()=>setTab("add")}>＋ Add food</button></div>
        {entries.length===0 ? <div className="empty-state"><h3>Your diary is ready</h3><p>Log your first meal to see your daily nutrition take shape.</p><button className="primary-button" onClick={()=>setTab("chat")}>Quick log a meal</button></div> :
          <div className="entry-list">{["Breakfast","Lunch","Snack","Dinner"].map(m=>{
            const group=entries.filter(e=>e.meal===m); if(!group.length)return null;
            return <div className="meal-group" key={m}><div className="meal-title"><span></span>{m}<span className="meal-count">{group.length}</span></div>
              {group.map(e=><React.Fragment key={e.id}>
                <div className="food-row"><div className="food-symbol">{e.name.charAt(0)}</div><div className="food-info"><strong>{e.name}</strong><span>{e.unitName ? formatServingCount(e.quantity, e.unitName) : `${e.quantity} × serving`} · {e.source==="chat"?"Quick log":"Manual entry"}</span></div><div className="food-macros"><strong>{fmt(e.protein)} g</strong><span>{Math.round(e.calories)} kcal</span></div><button className="remove-button" title={`Edit ${e.name}`} onClick={()=>startEditEntry(e)}>✎</button><button className="remove-button" title={`Remove ${e.name}`} onClick={()=>removeEntry(e.id)}>×</button></div>
                {editingEntryId===e.id && <div className="entry-edit">
                  <label>Quantity{e.unitName ? ` (${e.unitName}s)` : " (servings)"}<input type="number" min="0.1" step="0.1" value={editQty} onChange={ev=>setEditQty(ev.target.value)}/></label>
                  <div className="entry-edit-actions"><button className="primary-button compact" onClick={()=>saveEditEntry(e)}>Save</button><button className="text-button" onClick={()=>setEditingEntryId(null)}>Cancel</button></div>
                </div>}
              </React.Fragment>)}
            </div>
          })}</div>}
        <div className="diary-footer"><span>Nutrition values are estimates.</span><div><button className="text-button" onClick={exportData}>↓ Export backup</button><label className="text-button import-label">↑ Import backup<input type="file" accept="application/json,.json" onChange={importData} hidden/></label></div></div>
      </section>}

      {tab==="add" && <section className="panel add-panel">
        <div className="section-heading"><div><h2>Add food</h2></div><span className="soft-chip">Built-in & custom foods</span></div>
        <label className="search-box"><span>⌕</span><input placeholder="Search eggs, paneer, rice..." value={search} onChange={e=>setSearch(e.target.value)}/></label>
        <div className="food-picker">{filteredFoods.map(f=><button key={f.id} className={`food-option ${selectedFood===f.id?"selected":""}`} onClick={()=>setSelectedFood(f.id)}><span className="food-option-icon">{f.name.charAt(0)}</span><span className="food-option-name"><strong>{f.name}</strong><small>{f.unit} · {f.category}</small></span><span className="food-option-macro"><strong>{fmt(f.protein)} g</strong><small>{Math.round(f.calories)} kcal</small></span></button>)}</div>
        {chosen.sizes && <label className="meal-select">Piece size (approximate)<select value={addSize} onChange={e=>setAddSize(e.target.value)}><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select></label>}
        <div className="add-controls"><label>Quantity (servings)<input type="number" min="0.1" step="0.1" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label><label>Meal<select value={meal} onChange={e=>setMeal(e.target.value)}><option>Breakfast</option><option>Lunch</option><option>Snack</option><option>Dinner</option></select></label></div>
        <div className="selected-summary"><div><span>Selected</span><strong>{chosen.name}{chosen.sizes ? ` (${addSize})` : ""}</strong></div><div><span>Protein</span><strong>{fmt(unitFor(chosen,addSize).protein*(Number(quantity)||0))} g</strong></div><div><span>Calories</span><strong>{Math.round(unitFor(chosen,addSize).calories*(Number(quantity)||0))} kcal</strong></div></div>
        <button className="primary-button full-button" onClick={()=>addFood(chosen,quantity,meal,addSize)}>＋ Add to diary</button>
      </section>}

      {tab==="foods" && <section className="panel foods-panel">
        <div className="section-heading"><div><h2>My foods <span className="count">{customFoods.length}</span></h2></div>{!foodForm && <button className="primary-button compact" onClick={startNewFood}>＋ New food</button>}</div>

        {foodForm && <div className="food-form">
          <h3 className="form-title">{foodForm.id ? "Edit food" : "New food"}</h3>
          <div className="add-controls">
            <label>Food name<input value={foodForm.name} placeholder="e.g. Homemade roti" onChange={e=>updateForm("name",e.target.value)}/></label>
            <label>Measurement method<select value={foodForm.method} onChange={e=>updateForm("method",e.target.value)}><option value={METHOD_PER_SERVING}>Nutrition per serving</option><option value={METHOD_PER_100G}>Nutrition per 100 g</option></select></label>
            <label>Serving name<input value={foodForm.servingName} placeholder="chunk, piece, bowl, cup, scoop" onChange={e=>updateForm("servingName",e.target.value)}/></label>
            {foodForm.method===METHOD_PER_100G && <label>Weight of one serving (g)<input type="number" min="0" step="any" value={foodForm.servingWeightG} onChange={e=>updateForm("servingWeightG",e.target.value)}/></label>}
            <label>{formLabels.protein}<input type="number" min="0" step="any" value={foodForm.protein} onChange={e=>updateForm("protein",e.target.value)}/></label>
            <label>{formLabels.calories}<input type="number" min="0" step="any" value={foodForm.calories} onChange={e=>updateForm("calories",e.target.value)}/></label>
          </div>
          {formPreview && <div className="preview-box">
            <div className="preview-heading"><div><h3>Per {foodForm.servingName.trim() || "serving"}</h3></div></div>
            <div className="preview-row"><span>Protein</span><strong>{fmt(formPreview.protein)} g</strong></div>
            <div className="preview-total"><span>Calories</span><strong>{Math.round(formPreview.calories)} kcal</strong></div>
          </div>}
          {formError && <p className="warning-text">{formError}</p>}
          <div className="form-actions"><button className="primary-button" onClick={saveFood}>Save food</button><button className="text-button" onClick={cancelFood}>Cancel</button></div>
        </div>}

        {customFoods.length===0 && !foodForm ? <div className="empty-state"><h3>No custom foods yet</h3><p>Add foods with your own values, either per serving or per 100 g.</p><button className="primary-button" onClick={startNewFood}>＋ New food</button></div> :
          <div className="custom-list">{customFoods.map(f=>{
            const per = getPerServing(f);
            const perLabel = f.method===METHOD_PER_100G ? `${f.servingWeightG} g per ${f.servingName} · 100 g method` : "Per serving";
            return <div className="food-row" key={f.id}>
              <div className="food-symbol">{f.name.charAt(0)}</div>
              <div className="food-info"><strong>{f.name}</strong><span>{perLabel}</span></div>
              <div className="food-macros"><strong>{fmt(per.protein)} g</strong><span>{Math.round(per.calories)} kcal / {f.servingName}</span></div>
              <button className="remove-button" title={`Edit ${f.name}`} onClick={()=>editFood(f)}>✎</button>
              <button className="remove-button" title={`Delete ${f.name}`} onClick={()=>deleteFood(f)}>×</button>
            </div>;
          })}</div>}
      </section>}

      {tab==="family" && <section className="panel family-panel">
        <div className="section-heading"><div><div className="eyebrow">HOUSEHOLD</div><h2>Family profiles <span className="count">{profiles.length}</span></h2><p className="muted">A separate diary and daily goal for everyone.</p></div><button className="primary-button compact" onClick={()=>setProfileForm({name:"",proteinGoal:70,calorieGoal:2000})}>＋ Add member</button></div>
        <div className="family-grid">{profiles.map(p=><article key={p.id} className={`family-card ${profileId===p.id?"current":""}`}><div className="family-card-top"><span className="family-avatar">{p.name.charAt(0).toUpperCase()}</span>{profileId===p.id&&<span className="active-badge">Active</span>}</div><h3>{p.name}</h3><p>{p.proteinGoal} g protein · {p.calorieGoal} kcal / day</p><div className="family-actions"><button className="text-button" onClick={()=>{setActiveId(p.id);setTab("today")}}>View diary →</button><button className="text-button" onClick={()=>setProfileForm({...p})}>Edit</button><button className="text-button danger" disabled={profiles.length===1} onClick={()=>deleteProfile(p.id)}>Remove</button></div></article>)}</div>
        {profileForm && <form className="profile-form" onSubmit={saveProfile}><div className="section-heading"><h3>{profileForm.id?"Edit profile":"Add family member"}</h3><button type="button" className="text-button" onClick={()=>setProfileForm(null)}>Close ×</button></div><div className="goal-inputs"><label>Name<input required maxLength="40" placeholder="Family member's name" value={profileForm.name} onChange={e=>setProfileForm(f=>({...f,name:e.target.value}))}/></label><label>Protein goal (g)<input required type="number" min="1" value={profileForm.proteinGoal} onChange={e=>setProfileForm(f=>({...f,proteinGoal:e.target.value}))}/></label><label>Calorie goal (kcal)<input required type="number" min="1" value={profileForm.calorieGoal} onChange={e=>setProfileForm(f=>({...f,calorieGoal:e.target.value}))}/></label></div><div className="form-actions"><button className="primary-button" type="submit">Save profile</button><button type="button" className="text-button" onClick={()=>setProfileForm(null)}>Cancel</button></div></form>}
        <p className="fine-print">Profiles are stored only in this browser. Use Export backup in the food diary to save all family profiles and logs.</p>
      </section>}

      {tab==="chat" && <section className="panel chat-panel">
        <div className="section-heading"><div><h2>What did you eat?</h2></div><span className="chat-badge">✳ Smart parsing</span></div>
        <p className="muted">Write foods with quantities. Separate items with “and” or a plus sign.</p>
        <textarea value={chat} onChange={e=>{setChat(e.target.value);setPreview(null)}} placeholder={"For example:\n2 boiled eggs and 100 g paneer\n1 roti + 150 g cooked rice"} rows={4}/>
        <div className="example-chips"><button onClick={()=>setChat("2 boiled eggs and 100 g paneer")}>2 eggs + 100 g paneer</button><button onClick={()=>setChat("1 roti and 200 g dal")}>1 roti + 200 g dal</button><button onClick={()=>setChat("250 ml milk and 1 banana")}>250 ml milk + banana</button></div>
        <label className="meal-select">Add these to<select value={meal} onChange={e=>setMeal(e.target.value)}><option>Breakfast</option><option>Lunch</option><option>Snack</option><option>Dinner</option></select></label>
        <button className="primary-button full-button" onClick={()=>{if(!chat.trim()){setNotice("Type what you ate first.");return;}const p=parseChat(chat);setPreview(p);}}>Calculate nutrition</button>
        {preview && <div className="preview-box"><div className="preview-heading"><div><h3>Nutrition estimate</h3></div><span className="soft-chip">{preview.found.length} matched</span></div>
          {preview.found.map((e)=> e.needsSize ? <div className="size-ask" key={e.id}>
            <p><strong>{e.quantity} × {e.baseName}</strong>: {e.sizeQuestion} Values are approximate.</p>
            <div className="size-options">{["small","medium","large"].map(s=><button key={s} className={`size-chip ${e.size===s?"active":""}`} onClick={()=>setPreviewSize(e.id,s)}>{s[0].toUpperCase()+s.slice(1)}</button>)}</div>
          </div> : <div className="preview-row" key={e.id}><span>{e.name} <small>× {e.quantity}</small></span><strong>{e.protein} g · {e.calories} kcal</strong></div>)}
          {preview.missed.length>0 && <p className="warning-text">Not recognized: {preview.missed.join(", ")}. Add these manually, or try a simpler food name.</p>}
          {preview.found.length>0 && <><div className="preview-total"><span>Total</span><strong>{fmt(preview.found.reduce((a,e)=>a+e.protein,0))} g protein · {preview.found.reduce((a,e)=>a+e.calories,0)} kcal</strong></div>{preview.found.some(e=>e.needsSize) && <p className="warning-text">Choose the piece size above to include it.</p>}<button className="primary-button full-button" onClick={addPreview} disabled={preview.found.some(e=>e.needsSize)}>＋ Add matched foods to diary</button></>}
        </div>}
        <p className="fine-print">Quick log recognizes the built-in food list and common quantities. Check the results: recipes, cooking oil, brands, and serving sizes can change nutrition significantly.</p>
      </section>}

      {notice && <div className="toast" role="status">{notice}</div>}
      <footer className="footer"><span>dailyfuel <b>•</b> made for your everyday progress</span><span>Private by design · Stored on this browser</span></footer>
    </main>
  </div>;
}
