FROM apify/actor-node:16

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm --quiet set progress=false \
 && npm install --only=prod --no-optional \
 && echo "Installed NPM packages:" \
 && (npm list || true) \
 && echo "Node.js version:" \
 && node --version \
 && echo "NPM version:" \
 && npm --version

# Install Playwright browsers
RUN npx playwright install chromium

# Copy the rest of the actor files
COPY . ./

# Run the actor
CMD ["node", "main.js"]
