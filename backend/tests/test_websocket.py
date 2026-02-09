"""
WebSocket testing script
"""
import asyncio
import json
import websockets
import numpy as np
import sys

async def test_websocket():
    """Test WebSocket connection and messaging"""
    
    session_id = "test_session_001"
    uri = f"ws://localhost:8000/ws/{session_id}"
    
    print(f"Connecting to {uri}...")
    
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected!")
            
            # Wait for welcome message
            response = await websocket.recv()
            print(f"Received: {response}")
            
            # Send ping
            print("\nSending ping...")
            await websocket.send(json.dumps({"type": "ping", "data": {}}))
            response = await websocket.recv()
            print(f"Received: {response}")
            
            # Generate dummy landmark sequence
            print("\nSending landmark data...")
            sequence = []
            for frame in range(30):
                landmarks = []
                for landmark in range(21):
                    x = np.random.random()
                    y = np.random.random()
                    z = np.random.random() * 0.1
                    landmarks.append([x, y, z])
                sequence.append(landmarks)
            
            message = {
                "type": "landmarks",
                "data": {
                    "sequence": sequence,
                    "timestamp": 1234567890
                }
            }
            
            await websocket.send(json.dumps(message))
            
            # Wait for prediction
            response = await websocket.recv()
            result = json.loads(response)
            print(f"Prediction: {json.dumps(result, indent=2)}")
            
            # Check if audio was included
            if result.get("type") == "prediction":
                data = result.get("data", {})
                print(f"\nLabel: {data.get('label')}")
                print(f"Arabic: {data.get('arabic')}")
                print(f"Confidence: {data.get('confidence')}")
                print(f"Audio included: {'audio_base64' in data}")
            
            print("\nTest completed successfully!")
            
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(test_websocket())