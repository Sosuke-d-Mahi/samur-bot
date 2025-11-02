const axios = require('axios');

module.exports = {
  config: {
    name: "gitrepos",
    aliases: ["repos"],
    version: "1.0",
    author: "Mahi--",
    category: "information",
    guide: {
      en: "{pn} <Github Username>\n\nExample:\n{prefix}{pn} EASIRMAHI"
    }
  },

  onStart: async function ({ message, args }) {
    const username = args[0]; // Fetch the username from arguments
    if (!username) {
      return message.reply("Please provide a GitHub username.");
    }

    try {
      // Construct the GitHub API URL for fetching repos
      const apiUrl = `https://api.github.com/users/${username}/repos`;
      
      // Send GET request to the API
      const response = await axios.get(apiUrl);
      const repos = response.data;

      // Filter and collect the URLs for each repo
      const repoUrls = repos.map(repo => repo.url); // Extract only the 'url' field from each repository

      if (repoUrls.length === 0) {
        return message.reply("No repositories found for this user.");
      }

      // Format the response message
      const replyMessage = `
🌐 **GitHub Repositories for ${username}**:
${repoUrls.map((url, index) => `\n${index + 1}. ${url}`).join('')}
      `;

      // Send the formatted response
      return message.reply(replyMessage);

    } catch (error) {
      console.error(error);
      return message.reply("Failed to retrieve repositories. Please check the username and try again.");
    }
  }
};