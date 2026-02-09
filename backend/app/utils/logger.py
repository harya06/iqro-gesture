"""
Logging configuration
"""
import logging
import sys
from datetime import datetime


def setup_logger(name: str = "iqro") -> logging.Logger:
    """Setup and configure logger"""
    
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.DEBUG)
    
    # Format
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    console_handler.setFormatter(formatter)
    
    # File handler
    file_handler = logging.FileHandler(
        f'logs/iqro_{datetime.now().strftime("%Y%m%d")}.log'
    )
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(formatter)
    
    # Add handlers
    if not logger.handlers:
        logger.addHandler(console_handler)
        try:
            import os
            os.makedirs('logs', exist_ok=True)
            logger.addHandler(file_handler)
        except Exception:
            pass
    
    return logger


logger = setup_logger()