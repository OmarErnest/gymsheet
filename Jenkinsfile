pipeline {
  agent any

  environment {
    PYTHON = 'python3'
    NODE_ENV = 'test'
  }

  stages {
    stage('Backend install') {
      steps {
        dir('backend') {
          sh '${PYTHON} -m venv .venv'
          sh '. .venv/bin/activate && pip install --upgrade pip && pip install -r requirements.txt'
        }
      }
    }

    stage('Backend checks') {
      steps {
        dir('backend') {
          sh '. .venv/bin/activate && python manage.py check'
          sh '. .venv/bin/activate && python manage.py makemigrations --check --dry-run'
        }
      }
    }

    stage('Frontend install') {
      steps {
        dir('frontend') {
          sh 'npm ci || npm install'
        }
      }
    }

    stage('Frontend build') {
      steps {
        dir('frontend') {
          sh 'npm run build'
        }
      }
    }

    stage('Docker build') {
      steps {
        sh 'docker compose build'
      }
    }
  }
}
