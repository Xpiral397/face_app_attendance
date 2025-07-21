#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== AI Face Recognition Attendance System Setup ===${NC}"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check Python version
check_python() {
    if command_exists python3; then
        PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
        echo -e "${GREEN}✓ Python3 found: $PYTHON_VERSION${NC}"
        return 0
    elif command_exists python; then
        PYTHON_VERSION=$(python --version 2>&1 | awk '{print $2}')
        echo -e "${GREEN}✓ Python found: $PYTHON_VERSION${NC}"
        return 0
    else
        echo -e "${RED}✗ Python not found${NC}"
        return 1
    fi
}

# Function to install Python based on OS
install_python() {
    echo -e "${YELLOW}Installing Python...${NC}"
    
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        if command_exists apt-get; then
            echo "Installing Python using apt-get..."
            sudo apt-get update
            sudo apt-get install -y python3 python3-pip python3-venv
        elif command_exists yum; then
            echo "Installing Python using yum..."
            sudo yum install -y python3 python3-pip
        elif command_exists dnf; then
            echo "Installing Python using dnf..."
            sudo dnf install -y python3 python3-pip
        else
            echo -e "${RED}Unsupported Linux distribution. Please install Python manually.${NC}"
            exit 1
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command_exists brew; then
            echo "Installing Python using Homebrew..."
            brew install python
        else
            echo -e "${YELLOW}Please install Homebrew first: https://brew.sh/${NC}"
            echo -e "${YELLOW}Or download Python from: https://www.python.org/downloads/${NC}"
            exit 1
        fi
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        # Windows (Git Bash)
        echo -e "${YELLOW}Please install Python from: https://www.python.org/downloads/${NC}"
        echo -e "${YELLOW}Make sure to check 'Add Python to PATH' during installation${NC}"
        exit 1
    else
        echo -e "${RED}Unsupported operating system${NC}"
        exit 1
    fi
}

# Function to setup backend
setup_backend() {
    echo -e "${BLUE}=== Setting up Backend ===${NC}"
    
    cd backend
    
    # Check if virtual environment exists
    if [ ! -d "venv" ]; then
        echo -e "${YELLOW}Creating virtual environment...${NC}"
        python3 -m venv venv
    else
        echo -e "${GREEN}✓ Virtual environment already exists${NC}"
    fi
    
    # Activate virtual environment
    echo -e "${YELLOW}Activating virtual environment...${NC}"
    source venv/bin/activate
    
    # Upgrade pip
    echo -e "${YELLOW}Upgrading pip...${NC}"
    pip install --upgrade pip
    
    # Install requirements
    echo -e "${YELLOW}Installing Python dependencies...${NC}"
    if [ -f "requirements.txt" ]; then
        pip install -r requirements.txt
    else
        echo -e "${RED}requirements.txt not found${NC}"
        exit 1
    fi
    
    # Run migrations
    echo -e "${YELLOW}Running database migrations...${NC}"
    python manage.py makemigrations
    python manage.py migrate
    
    # Create superuser if needed
    echo -e "${YELLOW}Creating superuser...${NC}"
    echo "from django.contrib.auth import get_user_model; User = get_user_model(); User.objects.create_superuser('admin', 'admin@example.com', 'admin123') if not User.objects.filter(username='admin').exists() else None" | python manage.py shell
    
    echo -e "${GREEN}✓ Backend setup completed${NC}"
    cd ..
}

# Function to setup frontend
setup_frontend() {
    echo -e "${BLUE}=== Setting up Frontend ===${NC}"
    
    cd frontend
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}Installing Node.js dependencies...${NC}"
        npm install
    else
        echo -e "${GREEN}✓ Node.js dependencies already installed${NC}"
    fi
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        echo -e "${RED}package.json not found${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Frontend setup completed${NC}"
    cd ..
}

# Function to check Node.js
check_node() {
    if command_exists node; then
        NODE_VERSION=$(node --version)
        echo -e "${GREEN}✓ Node.js found: $NODE_VERSION${NC}"
        return 0
    else
        echo -e "${RED}✗ Node.js not found${NC}"
        return 1
    fi
}

# Function to install Node.js
install_node() {
    echo -e "${YELLOW}Installing Node.js...${NC}"
    
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        if command_exists curl; then
            echo "Installing Node.js using curl..."
            curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
            sudo apt-get install -y nodejs
        else
            echo -e "${RED}curl not found. Please install curl first.${NC}"
            exit 1
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command_exists brew; then
            echo "Installing Node.js using Homebrew..."
            brew install node
        else
            echo -e "${YELLOW}Please install Homebrew first: https://brew.sh/${NC}"
            echo -e "${YELLOW}Or download Node.js from: https://nodejs.org/${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}Please download Node.js from: https://nodejs.org/${NC}"
        exit 1
    fi
}

# Main setup process
main() {
    echo -e "${BLUE}Starting setup process...${NC}"
    
    # Check and install Python
    if ! check_python; then
        echo -e "${YELLOW}Python not found. Installing...${NC}"
        install_python
        if ! check_python; then
            echo -e "${RED}Failed to install Python${NC}"
            exit 1
        fi
    fi
    
    # Check and install Node.js
    if ! check_node; then
        echo -e "${YELLOW}Node.js not found. Installing...${NC}"
        install_node
        if ! check_node; then
            echo -e "${RED}Failed to install Node.js${NC}"
            exit 1
        fi
    fi
    
    # Setup backend
    setup_backend
    
    # Setup frontend
    setup_frontend
    
    echo -e "${GREEN}=== Setup Completed Successfully! ===${NC}"
    echo -e "${BLUE}To start the backend:${NC}"
    echo -e "cd backend && source venv/bin/activate && python manage.py runserver"
    echo -e "${BLUE}To start the frontend:${NC}"
    echo -e "cd frontend && npm run dev"
    echo -e "${BLUE}Default admin credentials:${NC}"
    echo -e "Username: admin"
    echo -e "Password: admin123"
}

# Run main function
main "$@" 