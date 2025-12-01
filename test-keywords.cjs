const fs = require("fs");
const path = require("path");

function getKeywordsFromCSV() {
	try {
		const csvPath = path.join(__dirname, "openehr_all-keywords_us_2025-12-01.csv");
		const csvContent = fs.readFileSync(csvPath, "utf-8");
		const lines = csvContent.split("\n");
		
		// Skip header row and extract first column (keywords)
		const keywords = lines
			.slice(1) // Skip header
			.map(line => line.split(",")[0]?.trim()) // Get first column
			.filter(keyword => keyword && keyword.length > 0); // Remove empty entries
		
		console.log(`Loaded ${keywords.length} keywords from CSV`);
		return keywords;
	} catch (error) {
		console.error("Error reading CSV file:", error);
		return [];
	}
}

// Run the function and display results
const keywords = getKeywordsFromCSV();
console.log(keywords);

