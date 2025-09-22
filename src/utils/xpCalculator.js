// src/utils/xpCalculator.js
const calculateXpAndLevel = (user) => {
    const XP_PER_EPISODE = 10; // Ini sudah diterapkan di controller
    const XP_BASE_FOR_LEVEL = 100;
    const XP_INCREMENT_PER_LEVEL = 50; // XP tambahan yang dibutuhkan setiap naik level

    let currentXp = user.xp;
    let currentLevel = user.level;
    let xpRequiredForNextLevel = user.xpForNextLevel;

    // Loop ini akan terus berjalan selama XP saat ini cukup untuk naik level berikutnya
    while (currentXp >= xpRequiredForNextLevel) {
        currentLevel++;
        currentXp -= xpRequiredForNextLevel; // Kurangi XP yang sudah dipakai untuk naik level

        // Hitung XP yang dibutuhkan untuk level berikutnya
        xpRequiredForNextLevel = XP_BASE_FOR_LEVEL + (currentLevel - 1) * XP_INCREMENT_PER_LEVEL;
    }

    // Update user object dengan nilai yang telah dihitung
    user.level = currentLevel;
    user.xp = currentXp; // Sisa XP setelah naik level
    user.xpForNextLevel = xpRequiredForNextLevel; // XP yang dibutuhkan untuk level baru
};

module.exports = { calculateXpAndLevel };