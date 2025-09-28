const { BlobServiceClient } = require("@azure/storage-blob");

module.exports = async function (context, req) {
    try {
        // Check if connection string exists
        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        if (!connectionString) {
            throw new Error("AZURE_STORAGE_CONNECTION_STRING environment variable is not set");
        }
        
        console.log("Connection string exists, creating blob service client...");
        
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient("visitor-data");
        const blobClient = containerClient.getBlobClient("visitor-count.json");
        
        console.log("Blob service client created successfully");
        
        let visitorCount = 1;
        
        try {
            // Ensure the container exists first
            await containerClient.createIfNotExists();
            console.log("Container exists or created successfully");
            
            // Try to read existing count
            const downloadResponse = await blobClient.download();
            const data = await streamToString(downloadResponse.readableStreamBody);
            const counters = JSON.parse(data);
            visitorCount = (counters.count || 0) + 1;
            console.log("Read existing count:", counters.count, "new count:", visitorCount);
        } catch (error) {
            // File doesn't exist, start with 1
            console.log("Starting new visitor count, error reading existing:", error.message);
        }
        
        // Update the count
        const updatedData = { 
            count: visitorCount, 
            lastUpdated: new Date().toISOString() 
        };
        
        console.log("Uploading updated data:", updatedData);
        await blobClient.upload(
            JSON.stringify(updatedData), 
            JSON.stringify(updatedData).length,
            { overwrite: true }
        );
        console.log("Successfully uploaded visitor count");
        
        context.res = {
            status: 200,
            headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: { 
                count: visitorCount,
                message: "Visitor count updated successfully"
            }
        };
        
    } catch (error) {
        console.error('Error updating visitor count:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            connectionStringExists: !!process.env.AZURE_STORAGE_CONNECTION_STRING,
            storageAccountName: process.env.STORAGE_ACCOUNT_NAME
        });
        
        context.res = {
            status: 500,
            headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: { 
                error: "Failed to update visitor count",
                errorMessage: error.message,
                count: "Error"
            }
        };
    }
};

// Helper function to convert stream to string
async function streamToString(readableStream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on("data", (data) => {
            chunks.push(data.toString());
        });
        readableStream.on("end", () => {
            resolve(chunks.join(""));
        });
        readableStream.on("error", reject);
    });
}