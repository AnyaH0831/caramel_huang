const { BlobServiceClient } = require("@azure/storage-blob");

module.exports = async function (context, req) {
    try {
        // For now, we'll use a simple counter stored in Azure Blob Storage
        // In production, you'd want to use Azure Table Storage or Cosmos DB
        
        const blobServiceClient = BlobServiceClient.fromConnectionString(
            process.env.AZURE_STORAGE_CONNECTION_STRING
        );
        
        const containerClient = blobServiceClient.getContainerClient("visitor-data");
        const blobClient = containerClient.getBlobClient("visitor-count.json");
        
        let visitorCount = 1;
        
        try {
            // Try to read existing count
            const downloadResponse = await blobClient.download();
            const data = await streamToString(downloadResponse.readableStreamBody);
            const counters = JSON.parse(data);
            visitorCount = (counters.count || 0) + 1;
        } catch (error) {
            // File doesn't exist, start with 1
            console.log("Starting new visitor count");
        }
        
        // Update the count
        const updatedData = { 
            count: visitorCount, 
            lastUpdated: new Date().toISOString() 
        };
        
        await blobClient.upload(
            JSON.stringify(updatedData), 
            JSON.stringify(updatedData).length,
            { overwrite: true }
        );
        
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
        context.res = {
            status: 500,
            headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: { 
                error: "Failed to update visitor count",
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