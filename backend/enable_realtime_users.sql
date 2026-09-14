-- Enable realtime for the users table so that mobile app can listen to loyalty point changes
ALTER PUBLICATION supabase_realtime ADD TABLE users;
