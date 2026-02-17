const express = require('express');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'history.json');

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

console.log("--------------------------------------");
console.log("SMART TEMP-AWARE SERVER ACTIVE");
console.log("--------------------------------------");

async function getHistory() {
    try {
        const data = await fs.readFile(DB_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

async function addToHistory(city, temp, desc, icon) {
    const history = await getHistory();
    const newEntry = { 
        city, 
        temp, 
        desc, 
        icon, 
        timestamp: new Date().toLocaleTimeString() 
    };
    
    history.unshift(newEntry);
    const trimmedHistory = history.slice(0, 5);
    await fs.writeFile(DB_FILE, JSON.stringify(trimmedHistory, null, 2));
}

function getWeatherDetails(wmoCode, temperature) {
    const videos = {
        hot: "https://videos.pexels.com/video-files/3205779/3205779-uhd_2560_1440_25fps.mp4", // Sunny Beach/Heat
        cold: "https://videos.pexels.com/video-files/857032/857032-hd_1920_1080_30fps.mp4", // Freezing Snow
        clear: "https://videos.pexels.com/video-files/854728/854728-hd_1920_1080_25fps.mp4",
        cloudy: "https://videos.pexels.com/video-files/856973/856973-hd_1920_1080_25fps.mp4",
        rain: "https://videos.pexels.com/video-files/4553258/4553258-hd_1920_1080_30fps.mp4",
        thunder: "https://videos.pexels.com/video-files/2932918/2932918-hd_1920_1080_25fps.mp4",
        fog: "https://videos.pexels.com/video-files/1779202/1779202-hd_1920_1080_25fps.mp4"
    };

    let desc = "Unknown";
    let icon = "03d"; 

    if (wmoCode === 0) { desc = "Clear Sky"; icon = "01d"; }
    else if (wmoCode <= 3) { desc = "Cloudy"; icon = "03d"; }
    else if (wmoCode <= 48) { desc = "Foggy"; icon = "50d"; }
    else if (wmoCode <= 67) { desc = "Rain"; icon = "10d"; }
    else if (wmoCode <= 77) { desc = "Snow"; icon = "13d"; }
    else if (wmoCode <= 82) { desc = "Heavy Rain"; icon = "09d"; }
    else if (wmoCode >= 95) { desc = "Thunderstorm"; icon = "11d"; }

    let selectedVideo = videos.cloudy; 

    if (temperature >= 30) {
        selectedVideo = videos.hot;
    } 
    else if (temperature <= 5) {
        selectedVideo = videos.cold;
    } 
    else {
        if (wmoCode === 0) selectedVideo = videos.clear;
        else if (wmoCode <= 3) selectedVideo = videos.cloudy;
        else if (wmoCode <= 48) selectedVideo = videos.fog;
        else if (wmoCode <= 82) selectedVideo = videos.rain;
        else if (wmoCode >= 95) selectedVideo = videos.thunder;
    }

    return {
        description: desc,
        iconUrl: `https://openweathermap.org/img/wn/${icon}@4x.png`,
        videoUrl: selectedVideo
    };
}

app.get('/', async (req, res) => {
    const history = await getHistory();
    const defaultVideo = "https://videos.pexels.com/video-files/856973/856973-hd_1920_1080_25fps.mp4";
    res.render('index', { weather: null, error: null, history: history, currentVideo: defaultVideo });
});

app.post('/', async (req, res) => {
    const city = req.body.city;
    const history = await getHistory();

    try {
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
        const geoResponse = await axios.get(geoUrl);

        if (!geoResponse.data.results || geoResponse.data.results.length === 0) {
            throw new Error("City not found");
        }

        const location = geoResponse.data.results[0];

        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current_weather=true`;
        const weatherResponse = await axios.get(weatherUrl);
        
        const current = weatherResponse.data.current_weather;
        
        const details = getWeatherDetails(current.weathercode, current.temperature);

        const weather = {
            city: location.name,
            country: location.country_code || "",
            temp: Math.round(current.temperature),
            desc: details.description,
            icon: details.iconUrl,
            humidity: "N/A", 
            wind: current.windspeed,
            video: details.videoUrl
        };

        await addToHistory(weather.city, weather.temp, weather.desc, weather.icon);
        const updatedHistory = await getHistory();

        res.render('index', { weather: weather, error: null, history: updatedHistory, currentVideo: weather.video });

    } catch (err) {
        console.error("Error:", err.message);
        const fallbackVideo = "https://videos.pexels.com/video-files/856973/856973-hd_1920_1080_25fps.mp4";
        res.render('index', { 
            weather: null, 
            error: "City not found.", 
            history: history,
            currentVideo: fallbackVideo
        });
    }
});

app.listen(PORT, () => {
    console.log(`Smart Weather App running at http://localhost:${PORT}`);
});