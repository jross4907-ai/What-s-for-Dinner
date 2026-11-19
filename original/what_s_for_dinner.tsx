import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, addDoc } from 'firebase/firestore';

// Firebase Setup
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const MEAL_POOL = [
  "🌮 Taco Tuesday (Any Day)",
  "🍕 Pizza (Takeout)",
  "🍝 Spaghetti & Meatballs",
  "🍲 Thai Curry (Takeout)",
  "🍔 Smash Burgers",
  "🥗 Grilled Chicken Caesar",
  "🍣 Sushi (Takeout)",
  "🍳 Breakfast for Dinner",
  "🥢 Chicken Stir Fry",
  "🥩 Steak & Potatoes",
  "🥪 Fancy Grilled Cheese & Soup",
  "🌯 Burrito Bowls",
  "🍛 Indian Curry (Takeout)",
  "🍗 Roast Chicken & Veggies",
  "🥟 Dumplings & Rice"
];

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function WhatsForDinnerApp() {
  const [activeTab, setActiveTab] = useState('veto'); // 'veto', 'calendar', 'history'
  
  // --- User Setup State ---
  const [user, setUser] = useState(null);
  const [userName, setUserName] = useState('');
  const [isNameSet, setIsNameSet] = useState(false);
  const [logs, setLogs] = useState([]);

  // --- Veto Engine State ---
  const [engineState, setEngineState] = useState('idle'); // 'idle', 'voting', 'result'
  const [options, setOptions] = useState([]);
  const [survivingOptions, setSurvivingOptions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [finalChoice, setFinalChoice] = useState(null);

  // --- Firebase Auth & Subscriptions ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined') {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error", err);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // Sync Calendar
  useEffect(() => {
    if (!user) return;
    const planRef = doc(db, 'artifacts', appId, 'public', 'data', 'weekPlans', 'master');
    const unsub = onSnapshot(planRef, (snapshot) => {
      if (snapshot.exists()) {
        setWeekPlan(snapshot.data());
      }
    }, (err) => console.error(err));
    return () => unsub();
  }, [user]);

  // Sync Logs (The "Spreadsheet")
  useEffect(() => {
    if (!user) return;
    const logsRef = collection(db, 'artifacts', appId, 'public', 'data', 'dinnerLogs');
    const unsub = onSnapshot(logsRef, (snapshot) => {
      const fetchedLogs = [];
      snapshot.forEach(d => fetchedLogs.push({id: d.id, ...d.data()}));
      // Sort in memory (newest first)
      fetchedLogs.sort((a,b) => new Date(b.date) - new Date(a.date));
      setLogs(fetchedLogs);
    }, (err) => console.error(err));
    return () => unsub();
  }, [user]);

  const logChoice = async (meal) => {
    if (!user || !isNameSet) return;
    const logsRef = collection(db, 'artifacts', appId, 'public', 'data', 'dinnerLogs');
    await addDoc(logsRef, {
      chosenMeal: meal,
      chosenBy: userName,
      date: new Date().toISOString()
    });
  };

  // --- Calendar State ---
  const [weekPlan, setWeekPlan] = useState({
    Monday: "",
    Tuesday: "🌮 Tacos",
    Wednesday: "",
    Thursday: "",
    Friday: "🍕 Pizza Night",
    Saturday: "",
    Sunday: "🍗 Roast Dinner"
  });

  const startVetoEngine = () => {
    // Pick 5 random options
    const shuffled = [...MEAL_POOL].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 5);
    setOptions(selected);
    setSurvivingOptions([]);
    setCurrentIndex(0);
    setFinalChoice(null);
    setEngineState('voting');
  };

  const handleVote = (keep) => {
    const currentMeal = options[currentIndex];
    let newSurviving = [...survivingOptions];
    
    if (keep) {
      newSurviving.push(currentMeal);
    }
    
    setSurvivingOptions(newSurviving);

    if (currentIndex + 1 < options.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Round over
      evaluateRound(newSurviving);
    }
  };

  const evaluateRound = (survivors) => {
    if (survivors.length === 0) {
      // Everything vetoed, fallback to pizza or pick a random one
      const defaultMeal = "🍕 You vetoed everything! Defaulting to Pizza!";
      setFinalChoice(defaultMeal);
      setEngineState('result');
      logChoice(defaultMeal);
    } else if (survivors.length === 1) {
      // Consensus reached!
      setFinalChoice(survivors[0]);
      setEngineState('result');
      logChoice(survivors[0]);
    } else {
      // Tie-breaker: reset with surviving options
      setOptions(survivors);
      setSurvivingOptions([]);
      setCurrentIndex(0);
    }
  };

  const updateCalendar = async (day, meal) => {
    const newPlan = { ...weekPlan, [day]: meal };
    setWeekPlan(newPlan); // Optimistic UI update
    if (user) {
      const planRef = doc(db, 'artifacts', appId, 'public', 'data', 'weekPlans', 'master');
      await setDoc(planRef, newPlan, { merge: true });
    }
  };

  // Name Selection Interstitial
  if (!isNameSet) {
    return (
      <div className="min-h-screen bg-orange-50 flex flex-col items-center justify-center p-4 font-sans">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center animate-fade-in">
          <div className="bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">👋</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Who's voting?</h1>
          <p className="text-slate-500 mb-8">Enter your name so Bianca knows who picked dinner.</p>
          <input 
            type="text" 
            placeholder="Your Name" 
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && userName.trim()) setIsNameSet(true) }}
            className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl mb-6 text-lg text-center font-medium focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition"
          />
          <button 
            onClick={() => userName.trim() && setIsNameSet(true)}
            disabled={!userName.trim()}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-xl shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            Let's Go!
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-orange-50 text-slate-800 font-sans flex flex-col items-center">
      {/* Header */}
      <header className="w-full bg-white shadow-sm p-4 text-center sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-orange-600">🍽️ What's for Dinner?</h1>
        <p className="text-sm text-slate-500">The Household Veto Engine</p>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-md p-4 flex flex-col relative pb-24">
        {activeTab === 'veto' && (
          <div className="flex flex-col h-full animate-fade-in">
            {engineState === 'idle' && (
              <div className="flex flex-col items-center justify-center h-full space-y-6 text-center mt-12">
                <div className="bg-orange-100 p-6 rounded-full">
                  <svg className="w-16 h-16 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </div>
                <h2 className="text-2xl font-bold">End the Debate</h2>
                <p className="text-slate-600">
                  Review 5 options. Veto what you don't want. The last meal standing wins. Pass the phone and take turns!
                </p>
                <button 
                  onClick={startVetoEngine}
                  className="mt-4 bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 px-8 rounded-full shadow-lg transform transition active:scale-95 text-lg w-full"
                >
                  Start Veto Engine
                </button>
              </div>
            )}

            {engineState === 'voting' && (
              <div className="flex flex-col items-center w-full mt-4 flex-1">
                <div className="w-full flex justify-between text-sm text-slate-500 mb-4 font-medium uppercase tracking-wider">
                  <span>Option {currentIndex + 1} of {options.length}</span>
                  <span>{survivingOptions.length} Kept</span>
                </div>
                
                {/* Meal Card */}
                <div className="bg-white w-full rounded-3xl shadow-xl p-8 flex flex-col items-center justify-center min-h-[300px] border border-orange-100 transform transition-all relative overflow-hidden">
                  <div className="absolute top-0 w-full h-2 bg-orange-100">
                    <div 
                      className="h-full bg-orange-500 transition-all duration-300"
                      style={{ width: `${((currentIndex + 1) / options.length) * 100}%` }}
                    />
                  </div>
                  <h3 className="text-3xl font-bold text-center text-slate-800 break-words w-full">
                    {options[currentIndex]}
                  </h3>
                </div>

                {/* Voting Buttons */}
                <div className="flex justify-between w-full mt-8 gap-4">
                  <button 
                    onClick={() => handleVote(false)}
                    className="flex-1 bg-red-100 hover:bg-red-200 text-red-600 font-bold py-6 rounded-2xl flex flex-col items-center justify-center transition active:scale-95 shadow-sm border border-red-200"
                  >
                    <span className="text-3xl mb-1">❌</span>
                    <span>VETO</span>
                  </button>
                  <button 
                    onClick={() => handleVote(true)}
                    className="flex-1 bg-green-100 hover:bg-green-200 text-green-700 font-bold py-6 rounded-2xl flex flex-col items-center justify-center transition active:scale-95 shadow-sm border border-green-200"
                  >
                    <span className="text-3xl mb-1">✅</span>
                    <span>KEEP</span>
                  </button>
                </div>
                
                {options.length < 5 && (
                  <p className="mt-6 text-sm text-slate-500 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100">
                    🔥 Tie-breaker mode!
                  </p>
                )}
              </div>
            )}

            {engineState === 'result' && (
              <div className="flex flex-col items-center justify-center h-full space-y-6 text-center mt-12 animate-bounce-in">
                <h2 className="text-xl font-bold text-slate-500 uppercase tracking-widest">Consensus Reached</h2>
                <div className="bg-white p-8 rounded-3xl shadow-2xl border-2 border-orange-400 w-full">
                  <h3 className="text-4xl font-extrabold text-orange-600 mb-4">{finalChoice}</h3>
                  <p className="text-slate-600 font-medium">No more debating. Dinner is decided.</p>
                </div>
                <button 
                  onClick={() => setEngineState('idle')}
                  className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-8 rounded-full shadow-md transition active:scale-95 mt-8 w-full"
                >
                  Start Over
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="flex flex-col animate-fade-in w-full pb-8">
            <div className="flex items-center justify-between mb-6 mt-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Bianca's Menu</h2>
                <p className="text-sm text-slate-500">The weekly master plan</p>
              </div>
              <div className="bg-orange-100 p-3 rounded-full">
                <span className="text-2xl">👩‍🍳</span>
              </div>
            </div>

            <div className="space-y-3 w-full">
              {DAYS_OF_WEEK.map((day) => (
                <div key={day} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col focus-within:ring-2 focus-within:ring-orange-300 transition-all">
                  <label className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-1">{day}</label>
                  <input
                    type="text"
                    placeholder="e.g. Taking the night off / Tacos"
                    value={weekPlan[day]}
                    onChange={(e) => updateCalendar(day, e.target.value)}
                    className="w-full bg-transparent border-none focus:outline-none text-slate-700 font-medium placeholder-slate-300 text-lg"
                  />
                </div>
              ))}
            </div>
            
            <button className="mt-6 w-full bg-orange-100 text-orange-700 font-bold py-3 rounded-xl border border-orange-200 active:scale-95 transition">
              Share Calendar
            </button>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="flex flex-col animate-fade-in w-full pb-8">
            <div className="flex items-center justify-between mb-6 mt-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Choice History</h2>
                <p className="text-sm text-slate-500">The dinner spreadsheet</p>
              </div>
              <div className="bg-orange-100 p-3 rounded-full">
                <span className="text-2xl">📋</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden w-full">
              {logs.length === 0 ? (
                <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                  <span className="text-4xl mb-3">👻</span>
                  <p>No dinners logged yet. Play the Veto Engine!</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500">
                        <th className="p-4 font-semibold whitespace-nowrap">Date</th>
                        <th className="p-4 font-semibold">Meal</th>
                        <th className="p-4 font-semibold">Decider</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} className="border-b border-slate-50 hover:bg-orange-50 transition">
                          <td className="p-4 text-sm text-slate-500 whitespace-nowrap">
                            {new Date(log.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </td>
                          <td className="p-4 font-medium text-slate-800">{log.chosenMeal}</td>
                          <td className="p-4 text-sm text-orange-600 font-bold whitespace-nowrap">{log.chosenBy}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full max-w-md bg-white border-t border-slate-200 flex pb-safe">
        <button 
          onClick={() => setActiveTab('veto')}
          className={`flex-1 py-3 flex flex-col items-center justify-center gap-1 transition-colors ${activeTab === 'veto' ? 'text-orange-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          <span className="text-[10px] font-bold uppercase tracking-wide">Veto</span>
        </button>
        <button 
          onClick={() => setActiveTab('calendar')}
          className={`flex-1 py-3 flex flex-col items-center justify-center gap-1 transition-colors ${activeTab === 'calendar' ? 'text-orange-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          <span className="text-[10px] font-bold uppercase tracking-wide">Calendar</span>
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-3 flex flex-col items-center justify-center gap-1 transition-colors ${activeTab === 'history' ? 'text-orange-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          <span className="text-[10px] font-bold uppercase tracking-wide">History</span>
        </button>
      </nav>

      {/* Global Styles for Animations & Safe Area */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounceIn {
          0% { transform: scale(0.9); opacity: 0; }
          50% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .animate-bounce-in { animation: bounceIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
      `}} />
    </div>
  );
}