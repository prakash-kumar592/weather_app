class WeatherApp {
    constructor() {
        // API Configuration - You'll need to replace this with your own API key
        this.API_KEY = 'YOUR_OPENWEATHERMAP_API_KEY'; // Get from https://openweathermap.org/api
        this.BASE_URL = 'https://api.openweathermap.org/data/2.5';
        this.ONECALL_URL = 'https://api.openweathermap.org/data/3.0/onecall';
        
        // App state
        this.currentUnit = 'metric'; // 'metric' for Celsius, 'imperial' for Fahrenheit
        this.currentTheme = 'light';
        this.recentCities = this.getRecentCities();
        
        // Initialize app
        this.initializeApp();
    }

    async initializeApp() {
        this.bindEvents();
        this.loadTheme();
        this.displayRecentCities();
        this.updateCurrentDate();
        
        // Try to get user's location on load
        await this.getCurrentLocationWeather();
        
        // Hide loading screen
        setTimeout(() => {
            document.getElementById('loadingScreen').classList.add('hidden');
            document.getElementById('mainContainer').classList.add('loaded');
        }, 1000);
    }

    bindEvents() {
        // Search functionality
        const searchBtn = document.getElementById('searchBtn');
        const cityInput = document.getElementById('cityInput');
        const locationBtn = document.getElementById('locationBtn');
        const themeToggle = document.getElementById('themeToggle');
        const unitToggle = document.getElementById('unitToggle');

        searchBtn.addEventListener('click', () => this.searchWeather());
        cityInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchWeather();
        });
        locationBtn.addEventListener('click', () => this.getCurrentLocationWeather());
        themeToggle.addEventListener('click', () => this.toggleTheme());
        unitToggle.addEventListener('click', () => this.toggleUnit());
    }

    async searchWeather() {
        const cityName = document.getElementById('cityInput').value.trim();
        if (!cityName) {
            this.showError('Please enter a city name');
            return;
        }

        this.showLoading();
        try {
            await this.getWeatherByCity(cityName);
            this.addToRecentCities(cityName);
            document.getElementById('cityInput').value = '';
            this.hideError();
        } catch (error) {
            this.showError('City not found. Please check the spelling and try again.');
        }
        this.hideLoading();
    }

    async getWeatherByCity(cityName) {
        try {
            // Get current weather
            const currentResponse = await fetch(
                `${this.BASE_URL}/weather?q=${cityName}&appid=${this.API_KEY}&units=${this.currentUnit}`
            );
            
            if (!currentResponse.ok) {
                throw new Error('City not found');
            }
            
            const currentData = await currentResponse.json();
            
            // Get coordinates for One Call API
            const { lat, lon } = currentData.coord;
            
            // Get 5-day forecast
            const forecastResponse = await fetch(
                `${this.BASE_URL}/forecast?lat=${lat}&lon=${lon}&appid=${this.API_KEY}&units=${this.currentUnit}`
            );
            
            let forecastData = null;
            if (forecastResponse.ok) {
                forecastData = await forecastResponse.json();
            }
            
            this.displayWeatherData(currentData, forecastData);
            this.updateBackground(currentData.weather[0].main, currentData.dt, currentData.sys.sunrise, currentData.sys.sunset);
            
        } catch (error) {
            console.error('Error fetching weather data:', error);
            throw error;
        }
    }

    async getCurrentLocationWeather() {
        if (!navigator.geolocation) {
            this.showError('Geolocation is not supported by this browser');
            return;
        }

        this.showLoading();
        
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    await this.getWeatherByCoordinates(latitude, longitude);
                    this.hideError();
                } catch (error) {
                    this.showError('Unable to fetch weather data for your location');
                }
                this.hideLoading();
            },
            (error) => {
                this.hideLoading();
                this.showError('Unable to access your location. Please search for a city manually.');
            }
        );
    }

    async getWeatherByCoordinates(lat, lon) {
        try {
            // Get current weather by coordinates
            const currentResponse = await fetch(
                `${this.BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${this.API_KEY}&units=${this.currentUnit}`
            );
            
            if (!currentResponse.ok) {
                throw new Error('Unable to fetch weather data');
            }
            
            const currentData = await currentResponse.json();
            
            // Get 5-day forecast
            const forecastResponse = await fetch(
                `${this.BASE_URL}/forecast?lat=${lat}&lon=${lon}&appid=${this.API_KEY}&units=${this.currentUnit}`
            );
            
            let forecastData = null;
            if (forecastResponse.ok) {
                forecastData = await forecastResponse.json();
            }
            
            this.displayWeatherData(currentData, forecastData);
            this.updateBackground(currentData.weather[0].main, currentData.dt, currentData.sys.sunrise, currentData.sys.sunset);
            
        } catch (error) {
            console.error('Error fetching weather data:', error);
            throw error;
        }
    }

    displayWeatherData(currentData, forecastData) {
        // Update current weather
        document.getElementById('cityName').textContent = currentData.name;
        document.getElementById('countryName').textContent = currentData.sys.country;
        document.getElementById('temperature').textContent = `${Math.round(currentData.main.temp)}°`;
        document.getElementById('weatherDescription').textContent = currentData.weather[0].description;
        document.getElementById('maxTemp').textContent = `${Math.round(currentData.main.temp_max)}°`;
        document.getElementById('minTemp').textContent = `${Math.round(currentData.main.temp_min)}°`;
        
        // Weather icon
        const iconCode = currentData.weather[0].icon;
        document.getElementById('weatherIcon').src = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
        document.getElementById('weatherIcon').alt = currentData.weather[0].description;
        
        // Weather details
        document.getElementById('visibility').textContent = `${(currentData.visibility / 1000).toFixed(1)} km`;
        document.getElementById('humidity').textContent = `${currentData.main.humidity}%`;
        document.getElementById('windSpeed').textContent = `${currentData.wind.speed} ${this.currentUnit === 'metric' ? 'km/h' : 'mph'}`;
        document.getElementById('feelsLike').textContent = `${Math.round(currentData.main.feels_like)}°`;
        document.getElementById('pressure').textContent = `${currentData.main.pressure} hPa`;
        document.getElementById('uvIndex').textContent = 'N/A'; // UV index not available in current weather API
        
        // Show current weather
        document.getElementById('currentWeather').classList.add('show');
        document.getElementById('currentWeather').classList.add('animate-in');
        
        // Display forecasts if available
        if (forecastData) {
            this.displayHourlyForecast(forecastData);
            this.displayDailyForecast(forecastData);
        }
    }

    displayHourlyForecast(forecastData) {
        const hourlyContainer = document.getElementById('hourlyForecast');
        hourlyContainer.innerHTML = '';
        
        // Get next 24 hours (8 items, 3-hour intervals)
        const next24Hours = forecastData.list.slice(0, 8);
        
        next24Hours.forEach(item => {
            const hourlyItem = document.createElement('div');
            hourlyItem.className = 'hourly-item';
            
            const time = new Date(item.dt * 1000);
            const timeString = time.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                hour12: true 
            });
            
            hourlyItem.innerHTML = `
                <div class="time">${timeString}</div>
                <img src="https://openweathermap.org/img/wn/${item.weather[0].icon}.png" alt="${item.weather[0].description}">
                <div class="temp">${Math.round(item.main.temp)}°</div>
                <div class="desc">${item.weather[0].main}</div>
            `;
            
            hourlyContainer.appendChild(hourlyItem);
        });
        
        // Show hourly forecast section
        document.querySelector('.forecast-section:nth-of-type(1)').classList.add('show');
    }

    displayDailyForecast(forecastData) {
        const dailyContainer = document.getElementById('dailyForecast');
        dailyContainer.innerHTML = '';
        
        // Group forecast data by day
        const dailyData = this.groupForecastByDay(forecastData.list);
        
        // Get next 5 days
        const dailyEntries = Object.entries(dailyData).slice(0, 5);
        
        dailyEntries.forEach(([date, dayData]) => {
            const dailyItem = document.createElement('div');
            dailyItem.className = 'daily-item';
            
            const dateObj = new Date(date);
            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
            
            // Calculate min/max temps for the day
            const temps = dayData.map(item => item.main.temp);
            const minTemp = Math.round(Math.min(...temps));
            const maxTemp = Math.round(Math.max(...temps));
            
            // Use the most common weather condition for the day
            const weatherCondition = this.getMostCommonWeather(dayData);
            
            dailyItem.innerHTML = `
                <div class="day">${dayName}</div>
                <img src="https://openweathermap.org/img/wn/${weatherCondition.icon}.png" alt="${weatherCondition.description}">
                <div class="desc">${weatherCondition.main}</div>
                <div class="temps">
                    <span class="high">${maxTemp}°</span>
                    <span class="low">${minTemp}°</span>
                </div>
            `;
            
            dailyContainer.appendChild(dailyItem);
        });
        
        // Show daily forecast section
        document.querySelector('.forecast-section:nth-of-type(2)').classList.add('show');
    }

    groupForecastByDay(forecastList) {
        const grouped = {};
        
        forecastList.forEach(item => {
            const date = new Date(item.dt * 1000).toDateString();
            if (!grouped[date]) {
                grouped[date] = [];
            }
            grouped[date].push(item);
        });
        
        return grouped;
    }

    getMostCommonWeather(dayData) {
        const weatherCount = {};
        
        dayData.forEach(item => {
            const weather = item.weather[0];
            const key = weather.main;
            if (!weatherCount[key]) {
                weatherCount[key] = { count: 0, weather: weather };
            }
            weatherCount[key].count++;
        });
        
        // Return the most common weather condition
        const mostCommon = Object.values(weatherCount).reduce((a, b) => 
            a.count > b.count ? a : b
        );
        
        return mostCommon.weather;
    }

    updateBackground(weatherMain, currentTime, sunrise, sunset) {
        const body = document.body;
        const isNight = currentTime < sunrise || currentTime > sunset;
        
        // Remove existing weather classes
        body.classList.remove('clear', 'clouds', 'rain', 'snow', 'night');
        
        if (isNight) {
            body.classList.add('night');
        } else {
            switch (weatherMain.toLowerCase()) {
                case 'clear':
                    body.classList.add('clear');
                    break;
                case 'clouds':
                    body.classList.add('clouds');
                    break;
                case 'rain':
                case 'drizzle':
                case 'thunderstorm':
                    body.classList.add('rain');
                    break;
                case 'snow':
                    body.classList.add('snow');
                    break;
                default:
                    body.classList.add('clear');
            }
        }
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        
        const themeIcon = document.querySelector('#themeToggle i');
        themeIcon.className = this.currentTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        
        localStorage.setItem('weather-app-theme', this.currentTheme);
    }

    toggleUnit() {
        this.currentUnit = this.currentUnit === 'metric' ? 'imperial' : 'metric';
        const unitToggle = document.getElementById('unitToggle');
        unitToggle.textContent = this.currentUnit === 'metric' ? '°C' : '°F';
        
        // Refresh current weather data with new units
        const cityName = document.getElementById('cityName').textContent;
        if (cityName && cityName !== 'New York') {
            this.getWeatherByCity(cityName);
        }
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('weather-app-theme');
        if (savedTheme) {
            this.currentTheme = savedTheme;
            document.documentElement.setAttribute('data-theme', this.currentTheme);
            
            const themeIcon = document.querySelector('#themeToggle i');
            themeIcon.className = this.currentTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        }
    }

    updateCurrentDate() {
        const now = new Date();
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        document.getElementById('currentDate').textContent = now.toLocaleDateString('en-US', options);
    }

    getRecentCities() {
        const saved = localStorage.getItem('weather-app-recent-cities');
        return saved ? JSON.parse(saved) : [];
    }

    addToRecentCities(cityName) {
        // Remove if already exists
        this.recentCities = this.recentCities.filter(city => 
            city.toLowerCase() !== cityName.toLowerCase()
        );
        
        // Add to beginning
        this.recentCities.unshift(cityName);
        
        // Keep only last 5 cities
        this.recentCities = this.recentCities.slice(0, 5);
        
        // Save to localStorage
        localStorage.setItem('weather-app-recent-cities', JSON.stringify(this.recentCities));
        
        // Update display
        this.displayRecentCities();
    }

    displayRecentCities() {
        const recentContainer = document.getElementById('recentList');
        const recentSection = document.getElementById('recentCities');
        
        if (this.recentCities.length === 0) {
            recentSection.classList.remove('show');
            return;
        }
        
        recentContainer.innerHTML = '';
        
        this.recentCities.forEach(city => {
            const cityElement = document.createElement('div');
            cityElement.className = 'recent-city';
            cityElement.textContent = city;
            cityElement.addEventListener('click', () => {
                document.getElementById('cityInput').value = city;
                this.searchWeather();
            });
            
            recentContainer.appendChild(cityElement);
        });
        
        recentSection.classList.add('show');
    }

    showLoading() {
        // You could add a loading indicator here
        document.querySelector('.search-btn i').className = 'fas fa-spinner fa-spin';
    }

    hideLoading() {
        document.querySelector('.search-btn i').className = 'fas fa-search';
    }

    showError(message) {
        const errorElement = document.getElementById('errorMessage');
        const errorText = document.getElementById('errorText');
        
        errorText.textContent = message;
        errorElement.classList.add('show');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.hideError();
        }, 5000);
    }

    hideError() {
        document.getElementById('errorMessage').classList.remove('show');
    }
}

// Initialize the weather app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new WeatherApp();
});

// Demo mode for testing without API key
if (document.querySelector('script[src*="script.js"]')) {
    // Add demo data function for testing
    WeatherApp.prototype.loadDemoData = function() {
        const demoData = {
            name: "New York",
            sys: { country: "US", sunrise: 1640000000, sunset: 1640040000 },
            main: {
                temp: 22,
                temp_max: 25,
                temp_min: 18,
                feels_like: 25,
                humidity: 65,
                pressure: 1013
            },
            weather: [{
                main: "Clear",
                description: "clear sky",
                icon: "01d"
            }],
            wind: { speed: 15 },
            visibility: 10000,
            dt: 1640020000
        };
        
        // If no API key is set, use demo data
        if (this.API_KEY === 'YOUR_OPENWEATHERMAP_API_KEY') {
            console.warn('Using demo data. Please set your OpenWeatherMap API key for live data.');
            this.displayWeatherData(demoData, null);
            document.getElementById('currentWeather').classList.add('show');
        }
    };
}