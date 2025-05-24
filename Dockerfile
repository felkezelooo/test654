FROM apify/actor-node-playwright:18

# Copy package.json first to leverage Docker cache
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

# Copy the rest of the actor files
COPY . ./

# Run the actor
CMD ["node", "main.js"]

